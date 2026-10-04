import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { completeAppointment } from "../../../../../modules/appointment-booking/lib/resource-ops"
import { getAppointmentService, listOwnedResourceIds } from "../../../resources/helpers"

/**
 * Marks a booked slot as completed (`:id` is the slot id). Only after it has
 * started, and only if it actually has a confirmed booking. Idempotent: an
 * already-completed slot returns as-is.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service = getAppointmentService(req)

  const [appointment] = await service.listAppointments(
    { id: req.params.id },
    { take: 1 }
  )
  const notFound = new MedusaError(MedusaError.Types.NOT_FOUND, "Appointment not found.")
  if (!appointment) throw notFound

  const owned = await listOwnedResourceIds(req)
  if (!owned.includes(appointment.provider_id)) throw notFound

  res.json({ appointment: await completeAppointment(service, appointment) })
}
