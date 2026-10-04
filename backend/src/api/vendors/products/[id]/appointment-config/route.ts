import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { assertNoOtherSaleMode, withSaleModeLock } from "../../../../../lib/sale-mode"
import { disableStockTracking } from "../../../../../lib/service-stock"
import { isUniqueViolation } from "../../../../../modules/appointment-booking/lib/db-errors"
import {
  computeReadiness,
  getAppointmentService,
  ownedResourcesFilter,
} from "../../../resources/helpers"
import { assertOwnership } from "../../helpers"

/**
 * Appointment settings for one of the vendor's products, seen from the product:
 * which of the seller's resources (people, rooms) offer it, and with what session
 * length and group size.
 *
 * It reads and writes the same offerings as a resource's Services tab, so the two
 * screens always agree. Only the caller's own resources and own products are ever
 * touched: "not yours" answers 404 exactly like "does not exist".
 */

const loadConfig = async (req: AuthenticatedMedusaRequest, productId: string) => {
  const service = getAppointmentService(req)

  const resources = await service.listProviders(await ownedResourcesFilter(req), {
    select: ["id", "display_name", "status", "kind", "timezone", "session_duration_minutes", "capacity"],
    take: null,
  })

  // An empty id list would mean "no constraint", so answer directly.
  if (!resources.length) {
    return { product_id: productId, offered_count: 0, resources: [] }
  }

  const ids = resources.map((r) => r.id)

  const [offerings, readiness] = await Promise.all([
    service.listServiceProviders(
      { service_product_id: productId, provider_id: ids },
      { take: null }
    ),
    computeReadiness(service, resources),
  ])
  const offeringByResource = new Map(offerings.map((o) => [o.provider_id, o]))

  const rows = resources
    .map((r) => {
      const offering = offeringByResource.get(r.id)
      const ready = readiness.get(r.id)
      return {
        id: r.id,
        display_name: r.display_name,
        kind: r.kind,
        status: r.status,
        timezone: r.timezone,
        default_duration_minutes: r.session_duration_minutes,
        default_capacity: r.capacity,
        offered: Boolean(offering),
        // null means "use the resource's own default".
        duration_minutes: offering?.duration_minutes ?? null,
        capacity: offering?.capacity ?? null,
        live: Boolean(offering && ready?.live),
        missing: ready?.missing ?? [],
      }
    })
    .sort((a, b) => (a.display_name ?? "").localeCompare(b.display_name ?? ""))

  return {
    product_id: productId,
    offered_count: rows.filter((r) => r.offered).length,
    resources: rows,
  }
}

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertOwnership(req, id)

  res.json(await loadConfig(req, id))
}

export const PostVendorAppointmentConfigSchema = z.object({
  resources: z
    .array(
      z.object({
        resource_id: z.string().min(1),
        duration_minutes: z.number().int().min(1).max(1440).nullable().optional(),
        capacity: z.number().int().min(1).max(10000).nullable().optional(),
      })
    )
    .max(500),
})

/**
 * Sets the full list of resources that offer this product. Applied as a diff, so
 * saving the same list twice changes nothing: rows already there are left alone
 * (or updated), only new ones are created and only removed ones are deleted, in
 * at most one create, one update and one delete. Existing bookings are not
 * affected by removing a resource.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof PostVendorAppointmentConfigSchema>>,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertOwnership(req, id)

  const service = getAppointmentService(req)

  const owned = await service.listProviders(await ownedResourcesFilter(req), {
    select: ["id", "session_duration_minutes"],
    take: null,
  })
  const ownedById = new Map(owned.map((r) => [r.id, r]))

  // Last entry wins if the same resource is listed twice.
  const wanted = new Map<string, { duration_minutes: number | null; capacity: number | null }>()
  for (const entry of req.validatedBody.resources) {
    if (!ownedById.has(entry.resource_id)) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Resource not found.")
    }
    wanted.set(entry.resource_id, {
      duration_minutes: entry.duration_minutes ?? null,
      capacity: entry.capacity ?? null,
    })
  }

  const apply = async () => {
    const existing = owned.length
      ? await service.listServiceProviders(
          { service_product_id: id, provider_id: owned.map((r) => r.id) },
          { take: null }
        )
      : []
    const existingByResource = new Map(existing.map((e) => [e.provider_id, e]))

    const toCreate = [...wanted.entries()]
      .filter(([resourceId]) => !existingByResource.has(resourceId))
      .map(([resourceId, s]) => ({
        provider_id: resourceId,
        service_product_id: id,
        // Legacy column is NOT NULL; keep it populated with the effective length.
        default_duration_minutes:
          s.duration_minutes ?? ownedById.get(resourceId)!.session_duration_minutes,
        duration_minutes: s.duration_minutes,
        capacity: s.capacity,
      }))

    const toUpdate = existing.flatMap((e) => {
      const s = wanted.get(e.provider_id)
      if (!s) return []
      if ((e.duration_minutes ?? null) === s.duration_minutes && (e.capacity ?? null) === s.capacity) {
        return []
      }
      return [
        {
          id: e.id,
          default_duration_minutes:
            s.duration_minutes ?? ownedById.get(e.provider_id)!.session_duration_minutes,
          duration_minutes: s.duration_minutes,
          capacity: s.capacity,
        },
      ]
    })

    const toDelete = existing.filter((e) => !wanted.has(e.provider_id)).map((e) => e.id)

    if (toCreate.length) await service.createServiceProviders(toCreate)
    if (toUpdate.length) await service.updateServiceProviders(toUpdate)
    if (toDelete.length) await service.deleteServiceProviders(toDelete)
  }

  // One sale mode per product (e.g. not while enquiries are on). Only when
  // resources are being offered - clearing the list must always work. The
  // check and the write share one lock so another mode cannot switch on
  // between them.
  await withSaleModeLock(req.scope, [id], async () => {
    if (wanted.size) {
      await assertNoOtherSaleMode(req.scope, id, "appointment")
    }

    try {
      await apply()
    } catch (err) {
      // A concurrent save inserted a row between our read and write; the diff is
      // idempotent, so recompute once from fresh state.
      if (!isUniqueViolation(err)) throw err
      await apply()
    }

    // A service has no stock to count (see service-stock.ts).
    if (wanted.size) await disableStockTracking(req.scope, [id])
  })

  res.json(await loadConfig(req, id))
}
