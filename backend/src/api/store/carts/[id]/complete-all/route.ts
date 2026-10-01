import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { canUseCart } from "../../../helpers/cart-access"
import { completeCartMarketplaceWorkflow } from "../../../../../workflows/complete-cart-marketplace"

/**
 * Completes any cart: standard items, tickets, rentals, appointments,
 * expressions of interest and digital products, in one request.
 *
 * The storefront calls this for every cart instead of choosing between the
 * tickets, rentals, digital and standard routes, which could each only
 * complete one kind of item.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params

  if (!(await canUseCart(req, id))) {
    return res.status(404).json({ message: "Cart not found" })
  }


  const { result } = await completeCartMarketplaceWorkflow(req.scope).run({
    input: { cart_id: id },
  })

  res.json({ type: "order", order: result.order })
}
