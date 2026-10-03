import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { buildBookingViews } from "../booking-view"
import { getService } from "../helpers"

export const GetMyBookingsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

/** The signed-in customer's own bookings, newest first. */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const customerId = (req as any).auth_context?.actor_id as string | undefined
  if (!customerId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Sign in to see your bookings.")
  }

  const service = getService(req)
  const { limit, offset } = req.validatedQuery as z.infer<typeof GetMyBookingsSchema>

  const [attendees, count] = await service.listAndCountAppointmentAttendees(
    {
      customer_id: customerId,
      // Confirmed bookings, and bookings that were cancelled by the buyer, the
      // business or an admin. A hold the system released because it was never
      // paid for was never a booking, so it is not listed.
      $or: [
        { status: "confirmed" },
        { status: "cancelled", cancelled_by: ["buyer", "vendor", "admin"] },
      ],
    },
    { take: limit, skip: offset, order: { created_at: "DESC" } }
  )

  res.json({
    bookings: await buildBookingViews(req, service, attendees),
    count,
    limit,
    offset,
  })
}
