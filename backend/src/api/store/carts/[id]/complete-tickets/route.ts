import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { completeCartWithTicketsWorkflow } from "../../../../../workflows/complete-cart-with-tickets"

/**
 * Completes a cart that contains tickets, recording the seats it sold.
 *
 * Ticket carts use this instead of the standard cart completion route: seats
 * have to be re-validated and written under the cart lock, and the standard
 * route knows nothing about either.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params

  const { result } = await completeCartWithTicketsWorkflow(req.scope).run({
    input: { cart_id: id },
  })

  res.json({ type: "order", order: result.order })
}
