import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * Retired. Appointments are now reserved when they are added to the cart and
 * confirmed by the single marketplace completion route, POST
 * /store/carts/:id/complete-all, which the storefront already uses for every
 * cart. The old dedicated route re-checked availability AFTER payment and could
 * not handle guest buyers, so it is closed rather than kept as a second,
 * weaker way to finish a booking.
 */
export const POST = async (_req: MedusaRequest, res: MedusaResponse) => {
  res.status(410).json({
    type: "not_allowed",
    message: "Use POST /store/carts/:id/complete-all to complete a cart.",
  })
}
