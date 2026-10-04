import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { cancelAppointmentWorkflow } from "../../../../../workflows/cancel-appointment"
import { CancelAppointmentSchema } from "../../../../vendors/resources/schemas"
import { getService } from "../../../providers/helpers"

/**
 * Cancels ONE attendee's booking (`:id` is the attendee id). Frees their place
 * and issues no refund - refunds stay a separate, deliberate action on the order.
 */
export const POST = async (
  req: MedusaRequest<z.infer<typeof CancelAppointmentSchema>>,
  res: MedusaResponse
) => {
  const [attendee] = await getService(req).listAppointmentAttendees(
    { id: req.params.id },
    { select: ["id"], take: 1 }
  )
  if (!attendee) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Booking not found.")
  }

  const { result } = await cancelAppointmentWorkflow(req.scope).run({
    input: {
      appointment_attendee_id: attendee.id,
      cancelled_by: "admin",
      reason: req.validatedBody.reason,
      notify: req.validatedBody.notify,
    },
  })

  res.json({ cancelled: result })
}
