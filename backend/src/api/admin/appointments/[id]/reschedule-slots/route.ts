import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { MAX_RANGE_DAYS } from "../../../../../modules/appointment-booking/lib/availability"
import { GetRescheduleSlotsSchema } from "../../../../vendors/resources/schemas"
import { getService } from "../../../providers/helpers"

/**
 * The times one booking (`:id` is the attendee id) could move to. Same rules as
 * the seller's list: the minimum-notice rule is waived, the booking's own
 * neighbouring times are available, and its current time is not offered.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service = getService(req)
  const { from, to } = req.validatedQuery as z.infer<typeof GetRescheduleSlotsSchema>

  const [attendee] = await service.listAppointmentAttendees(
    { id: req.params.id },
    { select: ["id"], take: 1 }
  )
  if (!attendee) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Booking not found.")
  }

  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Choose a range of at most ${MAX_RANGE_DAYS} days.`
    )
  }

  const { slots, provider } = await service.listRescheduleSlots({
    appointment_attendee_id: attendee.id,
    from,
    to,
    waiveNotice: true,
  })

  res.json({
    timezone: provider.timezone,
    count: slots.length,
    slots: slots.map((s) => ({
      start: s.start.toISOString(),
      end: s.end.toISOString(),
      capacity: s.capacity,
      capacity_remaining: s.capacity_remaining,
    })),
  })
}
