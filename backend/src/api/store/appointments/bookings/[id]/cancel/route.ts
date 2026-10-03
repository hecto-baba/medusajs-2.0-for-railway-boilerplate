import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { cancelAppointmentWorkflow } from "../../../../../../workflows/cancel-appointment"
import { assertBookingAccess, buildBookingViews } from "../../../booking-view"
import { getService } from "../../../helpers"

export const PostBuyerCancelSchema = z.object({
  reason: z.string().trim().max(500).nullable().optional(),
})

/**
 * Lets a buyer cancel their own booking - signed in, or via the link in their
 * confirmation email. Allowed only until the resource's cancellation deadline;
 * after that the buyer is told to contact the business. Frees the place and
 * issues no refund (refunds stay a separate, deliberate action on the order).
 */
export const POST = async (
  req: MedusaRequest<z.infer<typeof PostBuyerCancelSchema>>,
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

  if (attendee.status === "cancelled") {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "This booking is already cancelled.")
  }

  if (!view?.can_cancel) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "This booking can no longer be cancelled online. Please contact the business."
    )
  }

  const { result } = await cancelAppointmentWorkflow(req.scope).run({
    input: {
      appointment_attendee_id: attendee.id,
      cancelled_by: "buyer",
      reason: req.validatedBody?.reason ?? null,
    },
  })

  res.json({ cancelled: result })
}
