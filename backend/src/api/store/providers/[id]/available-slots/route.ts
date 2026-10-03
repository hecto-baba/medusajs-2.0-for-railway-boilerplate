import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

// Kept (and still registered in middlewares.ts) only so the import there keeps
// resolving; the route itself is retired.
export const GetAvailableSlotsSchema = z.object({
  service_duration_minutes: z.coerce.number().int().min(1),
  date_from: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: "date_from must be a valid date string",
  }),
  date_to: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: "date_to must be a valid date string",
  }),
})

/**
 * Retired. It returned time windows with no ids, took the slot length from the
 * client, had no range cap, did not check the provider was active or approved,
 * and could not be booked from. Use
 * GET /store/appointments/resources/:id/slots, which returns bookable slots with
 * their final price and enforces all of that.
 */
export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  res.status(410).json({
    type: "not_allowed",
    message: "Use GET /store/appointments/resources/:id/slots.",
  })
}
