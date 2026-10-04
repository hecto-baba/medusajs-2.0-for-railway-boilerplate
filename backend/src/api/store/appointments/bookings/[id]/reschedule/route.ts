import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { rescheduleAppointmentWorkflow } from "../../../../../../workflows/reschedule-appointment"
import { assertBookingAccess, buildBookingViews } from "../../../booking-view"
import { getService } from "../../../helpers"

export const PostBuyerRescheduleSchema = z.object({
  start: z.coerce.date(),
})

/**
 * Lets a buyer move their own booking - signed in, or via the link in their
 * email. Same resource and service only, until the resource's change deadline and
 * at most a couple of times (enforced in the workflow, from the same rule that
 * drives `can_reschedule`). No charge, no refund: the order is untouched.
 */
export const POST = async (
  req: MedusaRequest<z.infer<typeof PostBuyerRescheduleSchema>>,
  res: MedusaResponse
) => {
  const service = getService(req)

  const [attendee] = await service.listAppointmentAttendees(
    { id: req.params.id },
    { take: 1 }
  )
  if (!attendee) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Booking not found.")
  }

  assertBookingAccess(req, attendee)

  const [view] = await buildBookingViews(req, service, [attendee])
  if (!view?.can_reschedule) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "This booking can no longer be changed online. Please contact the business."
    )
  }

  const { result } = await rescheduleAppointmentWorkflow(req.scope).run({
    input: {
      appointment_attendee_id: attendee.id,
      new_start: req.validatedBody.start.toISOString(),
      rescheduled_by: "buyer",
    },
  })

  res.json({ rescheduled: result })
}
