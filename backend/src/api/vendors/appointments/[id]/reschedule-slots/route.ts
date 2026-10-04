import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { MAX_RANGE_DAYS } from "../../../../../modules/appointment-booking/lib/availability"
import { getAppointmentService, listOwnedResourceIds } from "../../../resources/helpers"
import { GetRescheduleSlotsSchema } from "../../../resources/schemas"

/**
 * The times a seller could move one booking (`:id` is the attendee id) to. The
 * notice rule is waived, as for a booking entered by hand; everything else still
 * applies. Ownership: attendee -> slot -> resource must be the calling vendor's.
 */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service = getAppointmentService(req)
  const { from, to } = req.validatedQuery as z.infer<typeof GetRescheduleSlotsSchema>
  const notFound = new MedusaError(MedusaError.Types.NOT_FOUND, "Booking not found.")

  const [attendee] = await service.listAppointmentAttendees({ id: req.params.id }, { take: 1 })
  if (!attendee) throw notFound
  const [appointment] = await service.listAppointments(
    { id: attendee.appointment_id },
    { select: ["id", "provider_id"], take: 1 }
  )
  if (!appointment) throw notFound
  const owned = await listOwnedResourceIds(req)
  if (!owned.includes(appointment.provider_id)) throw notFound

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
