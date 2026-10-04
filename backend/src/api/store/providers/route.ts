import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * Retired. This listed EVERY active provider - including those belonging to
 * vendors that have not been approved - with no way to find what each one
 * offers. Buyers now use GET /store/appointments/businesses, which only shows
 * approved businesses with a live resource.
 */
export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  res.status(410).json({
    type: "not_allowed",
    message: "Use GET /store/appointments/businesses.",
  })
}
