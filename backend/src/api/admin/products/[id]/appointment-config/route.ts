import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { APPOINTMENT_BOOKING_MODULE } from "../../../../../modules/appointment-booking"
import type AppointmentBookingModuleService from "../../../../../modules/appointment-booking/service"
import { isUniqueViolation } from "../../../../../modules/appointment-booking/lib/db-errors"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const service: AppointmentBookingModuleService = req.scope.resolve(
    APPOINTMENT_BOOKING_MODULE
  )

  const serviceProviders = await service.listServiceProviders(
    { service_product_id: id },
    { take: null }
  )

  res.json({ service_providers: serviceProviders })
}

export const PostAppointmentConfigBodySchema = z.object({
  provider_ids: z.array(z.string()).max(500),
  default_duration_minutes: z.number().int().min(1).max(24 * 60),
})


/**
 * Sets the full set of providers offering this product as a service.
 *
 * Applied as a diff against what is stored - rows already present are left
 * alone (or have their duration updated), only genuinely new rows are created
 * and only removed ones are deleted. Two properties follow from that:
 *   - Idempotent: submitting the same payload twice changes nothing the
 *     second time, so a retried or double-clicked Save is harmless.
 *   - It never trips the (provider_id, service_product_id) unique index by
 *     re-creating a row that already exists, which the previous
 *     create-everything-then-delete-old approach did on any re-save.
 * All reads and writes are batched (one list, at most one create, one update
 * batch and one delete per request) rather than looped per provider.
 */
export const POST = async (
  req: MedusaRequest<z.infer<typeof PostAppointmentConfigBodySchema>>,
  res: MedusaResponse
) => {
  const { id } = req.params
  const { default_duration_minutes } = req.validatedBody
  const provider_ids = [...new Set(req.validatedBody.provider_ids)]

  const service: AppointmentBookingModuleService = req.scope.resolve(
    APPOINTMENT_BOOKING_MODULE
  )

  if (provider_ids.length) {
    const found = await service.listProviders(
      { id: provider_ids },
      { select: ["id"], take: provider_ids.length }
    )
    if (found.length !== provider_ids.length) {
      const foundIds = new Set(found.map((p) => p.id))
      const missing = provider_ids.filter((pid) => !foundIds.has(pid))
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Provider(s) not found: ${missing.join(", ")}`
      )
    }
  }

  const apply = async () => {
    const existing = await service.listServiceProviders(
      { service_product_id: id },
      { take: null }
    )
    const existingByProvider = new Map(existing.map((sp) => [sp.provider_id, sp]))
    const wanted = new Set(provider_ids)

    const toCreate = provider_ids
      .filter((pid) => !existingByProvider.has(pid))
      .map((provider_id) => ({
        provider_id,
        service_product_id: id,
        default_duration_minutes,
        // The slot engine reads duration_minutes; default_duration_minutes is the
        // legacy column kept in step with it for older readers.
        duration_minutes: default_duration_minutes,
      }))

    const toUpdate = existing
      .filter(
        (sp) =>
          wanted.has(sp.provider_id) &&
          sp.default_duration_minutes !== default_duration_minutes
      )
      // Only the legacy column is touched on an existing offering: a seller may
      // have set a per-resource session length (duration_minutes), and a bulk
      // edit from the product page must not overwrite those.
      .map((sp) => ({ id: sp.id, default_duration_minutes }))

    const toDelete = existing
      .filter((sp) => !wanted.has(sp.provider_id))
      .map((sp) => sp.id)

    if (toCreate.length) await service.createServiceProviders(toCreate)
    if (toUpdate.length) await service.updateServiceProviders(toUpdate)
    if (toDelete.length) await service.deleteServiceProviders(toDelete)
  }

  try {
    await apply()
  } catch (err) {
    // A concurrent save for the same product can create a row between our read
    // and our write. The diff is cheap and idempotent, so recompute once from
    // fresh state instead of surfacing a raw constraint error.
    if (!isUniqueViolation(err)) throw err
    await apply()
  }

  const service_providers = await service.listServiceProviders(
    { service_product_id: id },
    { take: null }
  )

  res.json({ service_providers })
}
