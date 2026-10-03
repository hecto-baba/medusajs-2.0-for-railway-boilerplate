import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { rescheduleAppointmentWorkflow } from "../../../../../workflows/reschedule-appointment"
import { getAppointmentService, listOwnedResourceIds } from "../../../resources/helpers"
import { RescheduleAppointmentSchema } from "../../../resources/schemas"

/**
 * Moves ONE attendee's booking (`:id` is the attendee id) to another time on the
 * same resource and service. The business is not held to the customer's change
 * window or reschedule limit, and may move a booking inside the notice window.
 * Payment is untouched.
 *
 * Ownership: attendee -> slot -> resource must be the calling vendor's.
 * Anything else is a 404.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof RescheduleAppointmentSchema>>,
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

  const { result } = await rescheduleAppointmentWorkflow(req.scope).run({
    input: {
      appointment_attendee_id: attendee.id,
      new_start: req.validatedBody.start.toISOString(),
      rescheduled_by: "vendor",
      notify: req.validatedBody.notify,
    },
  })

  res.json({ rescheduled: result })
}
