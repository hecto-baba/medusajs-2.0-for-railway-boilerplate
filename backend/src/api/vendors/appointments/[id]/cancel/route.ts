import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { cancelAppointmentWorkflow } from "../../../../../workflows/cancel-appointment"
import { getAppointmentService, listOwnedResourceIds } from "../../../resources/helpers"
import { CancelAppointmentSchema } from "../../../resources/schemas"

/**
 * Cancels ONE attendee's booking (`:id` is the attendee id, not the slot id).
 * Frees their place and issues NO refund - refunds stay a separate, deliberate
 * action on the order.
 *
 * Ownership: attendee -> slot -> resource must be the calling vendor's.
 * Anything else is a 404.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof CancelAppointmentSchema>>,
  res: MedusaResponse
) => {
  const service = getAppointmentService(req)

  const [attendee] = await service.listAppointmentAttendees(
    { id: req.params.id },
    { take: 1 }
  )
  const notFound = new MedusaError(MedusaError.Types.NOT_FOUND, "Booking not found.")
  if (!attendee) throw notFound

  const [appointment] = await service.listAppointments(
    { id: attendee.appointment_id },
    { select: ["id", "provider_id"], take: 1 }
  )
  if (!appointment) throw notFound

  const owned = await listOwnedResourceIds(req)
  if (!owned.includes(appointment.provider_id)) throw notFound

  const { result } = await cancelAppointmentWorkflow(req.scope).run({
    input: {
      appointment_attendee_id: attendee.id,
      cancelled_by: "vendor",
      reason: req.validatedBody.reason,
      notify: req.validatedBody.notify,
    },
  })

  res.json({ cancelled: result })
}
