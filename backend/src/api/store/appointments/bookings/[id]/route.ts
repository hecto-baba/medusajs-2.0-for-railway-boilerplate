import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { assertBookingAccess, buildBookingViews } from "../../booking-view"
import { getService } from "../../helpers"

/**
 * One booking, for the buyer's confirmation / cancel page. Reachable by the
 * signed-in customer it belongs to, or by anyone holding its signed link.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service = getService(req)

  const [attendee] = await service.listAppointmentAttendees(
    { id: req.params.id },
    { take: 1 }
  )
  if (!attendee) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Booking not found.")
  }

  assertBookingAccess(req, attendee)

  const [booking] = await buildBookingViews(req, service, [attendee])
  res.json({ booking })
}
