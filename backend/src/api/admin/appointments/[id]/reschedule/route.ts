import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { rescheduleAppointmentWorkflow } from "../../../../../workflows/reschedule-appointment"
import { RescheduleAppointmentSchema } from "../../../../vendors/resources/schemas"
import { getService } from "../../../providers/helpers"

/**
 * Moves ONE attendee's booking (`:id` is the attendee id) to another time on the
 * same resource and service. An admin is not held to the customer's change window
 * or reschedule limit. Payment is untouched.
 */
export const POST = async (
  req: MedusaRequest<z.infer<typeof RescheduleAppointmentSchema>>,
  res: MedusaResponse
) => {
  const [attendee] = await getService(req).listAppointmentAttendees(
    { id: req.params.id },
    { select: ["id"], take: 1 }
  )
  if (!attendee) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Booking not found.")
  }

  const { result } = await rescheduleAppointmentWorkflow(req.scope).run({
    input: {
      appointment_attendee_id: attendee.id,
      new_start: req.validatedBody.start.toISOString(),
      rescheduled_by: "admin",
      notify: req.validatedBody.notify,
    },
  })

  res.json({ rescheduled: result })
}
