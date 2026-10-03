import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { APPOINTMENT_BOOKING_MODULE } from "../../../modules/appointment-booking"
import type AppointmentBookingModuleService from "../../../modules/appointment-booking/service"
import { getVendorId } from "../shared/vendor-scope"
import { getCachedVendorId } from "../shared/require-approved-vendor"

export const getAppointmentService = (
  req: AuthenticatedMedusaRequest
): AppointmentBookingModuleService => req.scope.resolve(APPOINTMENT_BOOKING_MODULE)

/**
 * The calling vendor's id, always derived from the session (never from the
 * request). Reuses what the approval gate already resolved when it can.
 */
export const resolveVendorId = async (
  req: AuthenticatedMedusaRequest
): Promise<string> =>
  getCachedVendorId(req.auth_context?.actor_id) ?? (await getVendorId(req))

/**
 * Loads a resource and proves the calling vendor owns it.
 *
 * "Not yours" answers 404, exactly like "does not exist", so the route cannot
 * be used to discover other vendors' ids. Every route that takes a resource id
 * MUST call this before reading or writing anything.
 *
 * Resources created before multi-resource support have no vendor_id; they are
 * owned by the staff login that created them, and are adopted into the vendor
 * the first time that login touches them.
 */
export const assertResourceOwned = async (
  req: AuthenticatedMedusaRequest,
  resourceId: string
) => {
  const service = getAppointmentService(req)
  const [resource] = await service.listProviders({ id: resourceId }, { take: 1 })
  const notFound = new MedusaError(MedusaError.Types.NOT_FOUND, "Resource not found.")

  if (!resource) throw notFound

  const vendorId = await resolveVendorId(req)

  if (resource.vendor_id) {
    if (resource.vendor_id !== vendorId) throw notFound
    return resource
  }

  if (resource.vendor_admin_id !== req.auth_context.actor_id) throw notFound

  await service.updateProviders({ id: resource.id, vendor_id: vendorId })
  return { ...resource, vendor_id: vendorId }
}

/** Filter matching every resource the calling vendor owns (incl. unadopted legacy ones). */
export const ownedResourcesFilter = async (req: AuthenticatedMedusaRequest) => {
  const vendorId = await resolveVendorId(req)
  return {
    $or: [
      { vendor_id: vendorId },
      { vendor_id: null, vendor_admin_id: req.auth_context.actor_id },
    ],
  }
}

/** Ids of every resource the calling vendor owns. */
export const listOwnedResourceIds = async (
  req: AuthenticatedMedusaRequest
): Promise<string[]> => {
  const service = getAppointmentService(req)
  const rows = await service.listProviders(await ownedResourcesFilter(req), {
    select: ["id"],
    take: null,
  })
  return rows.map((r) => r.id)
}

export type Readiness = {
  has_hours: boolean
  has_services: boolean
  /** Visible to buyers: active, has weekly hours and offers a service. */
  live: boolean
  missing: string[]
}

/**
 * Whether each resource is ready to take bookings, computed for the whole list
 * with two queries (not two per resource).
 */
export const computeReadiness = async (
  service: AppointmentBookingModuleService,
  resources: { id: string; status: string }[]
): Promise<Map<string, Readiness>> => {
  const result = new Map<string, Readiness>()
  if (!resources.length) return result

  const ids = resources.map((r) => r.id)

  const [rules, offerings] = await Promise.all([
    service.listRecurringAvailabilities(
      { provider_id: ids, status: "active" },
      { select: ["id", "provider_id"], take: null }
    ),
    service.listServiceProviders(
      { provider_id: ids },
      { select: ["id", "provider_id"], take: null }
    ),
  ])

  const withHours = new Set(rules.map((r) => r.provider_id))
  const withServices = new Set(offerings.map((o) => o.provider_id))

  for (const r of resources) {
    const has_hours = withHours.has(r.id)
    const has_services = withServices.has(r.id)
    const missing: string[] = []
    if (r.status !== "active") missing.push("Resource is inactive")
    if (!has_hours) missing.push("Add weekly hours")
    if (!has_services) missing.push("Offer at least one service")
    result.set(r.id, {
      has_hours,
      has_services,
      live: missing.length === 0,
      missing,
    })
  }

  return result
}
