import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { MAX_RANGE_DAYS } from "../../../../../../modules/appointment-booking/lib/availability"
import { buyerPriceGuard } from "../../../../../../modules/appointment-booking/lib/reschedule-pricing"
import { GetRescheduleSlotsSchema } from "../../../../../vendors/resources/schemas"
import { assertBookingAccess } from "../../../booking-view"
import { getService } from "../../../helpers"

/** The shared window, plus the signed link token the guest's page passes along. */
export const GetBuyerRescheduleSlotsSchema = GetRescheduleSlotsSchema.extend({
  token: z.string().optional(),
})

/**
 * The times a buyer could move their own booking to: same resource and service,
 * priced as before (so no price is shown), never including the current time.
 * Reachable by the signed-in customer or the holder of the booking's signed link.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service = getService(req)
  const { from, to } = req.validatedQuery as z.infer<typeof GetBuyerRescheduleSlotsSchema>

  const [attendee] = await service.listAppointmentAttendees(
    { id: req.params.id },
    { take: 1 }
  )
  if (!attendee) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Booking not found.")
  }
  assertBookingAccess(req, attendee)

  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Choose a range of at most ${MAX_RANGE_DAYS} days.`
    )
  }

  const { slots: candidates, provider, appointment } = await service.listRescheduleSlots({
    appointment_attendee_id: attendee.id,
    from,
    to,
    waiveNotice: false,
  })

  // Pricing rules can make some times dearer; a move is free, so a buyer is only
  // offered times at the same price (the move itself re-checks this).
  const samePrice = await buyerPriceGuard(req.scope, service, {
    orderId: attendee.order_id,
    resourceId: appointment.provider_id,
    productId: appointment.service_product_id,
    vendorId: provider.vendor_id,
    timezone: appointment.resource_timezone ?? provider.timezone,
    currentStart: appointment.start_time,
  })
  const slots = samePrice ? candidates.filter((s) => samePrice(s.start)) : candidates

  res.json({
    resource: { id: provider.id, timezone: provider.timezone },
    count: slots.length,
    slots: slots.map((s) => ({
      start: s.start.toISOString(),
      end: s.end.toISOString(),
      capacity: s.capacity,
      spots_left: s.capacity_remaining,
    })),
  })
}
