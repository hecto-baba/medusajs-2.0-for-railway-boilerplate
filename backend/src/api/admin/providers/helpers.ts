import type { MedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { APPOINTMENT_BOOKING_MODULE } from "../../../modules/appointment-booking"
import type AppointmentBookingModuleService from "../../../modules/appointment-booking/service"

export const getService = (req: MedusaRequest): AppointmentBookingModuleService =>
  req.scope.resolve(APPOINTMENT_BOOKING_MODULE)

/** Loads a resource by id or answers 404. Admins may act on any vendor's resource. */
export const loadResource = async (req: MedusaRequest, id: string) => {
  const [resource] = await getService(req).listProviders({ id }, { take: 1 })
  if (!resource) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Resource not found.")
  }
  return resource
}

/** Vendor names for a set of resources, in one query (not one per resource). */
export const vendorsById = async (
  req: MedusaRequest,
  vendorIds: (string | null | undefined)[]
): Promise<Map<string, { id: string; name: string; handle: string }>> => {
  const ids = [...new Set(vendorIds.filter((v): v is string => !!v))]
  if (!ids.length) return new Map()

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "vendor",
    fields: ["id", "name", "handle"],
    filters: { id: ids },
  })
  return new Map((data as any[]).map((v) => [v.id, v]))
}
