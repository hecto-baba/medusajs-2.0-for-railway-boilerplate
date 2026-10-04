import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

// Still exported (and registered in middlewares.ts) so the import there keeps
// resolving; the route itself is retired.
export const PostAdminAppointmentSlotsSchema = z.object({
  service_product_id: z.string(),
  service_variant_id: z.string().nullable().optional(),
  service_duration_minutes: z.number().int().min(1),
  max_capacity: z.number().int().min(1).optional(),
  date_from: z.coerce.date(),
  date_to: z.coerce.date(),
})

/** Retired - slots are computed live from the resource's schedule and rules. */
export const POST = async (_req: MedusaRequest, res: MedusaResponse) => {
  res.status(410).json({
    type: "not_allowed",
    message: "Slots are generated automatically from the resource's schedule.",
  })
}
