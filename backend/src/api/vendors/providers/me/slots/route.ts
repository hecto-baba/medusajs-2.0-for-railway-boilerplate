import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

// Still exported (and registered in middlewares.ts) so the import there keeps
// resolving; the route itself is retired.
export const PostVendorAppointmentSlotsSchema = z.object({
  service_product_id: z.string(),
  service_variant_id: z.string().nullable().optional(),
  service_duration_minutes: z.number().int().min(1),
  max_capacity: z.number().int().min(1).optional(),
  date_from: z.coerce.date(),
  date_to: z.coerce.date(),
})

/**
 * Retired. Slots are no longer generated and stored in advance: they are worked
 * out live from each resource's weekly hours, holidays, session length, buffers
 * and rules, and a booking row is created only when someone reserves one. Use
 * GET /vendors/resources/:id/slots-preview to see them.
 */
export const POST = async (
  _req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  res.status(410).json({
    type: "not_allowed",
    message: "Slots are generated automatically. Use GET /vendors/resources/:id/slots-preview.",
  })
}
