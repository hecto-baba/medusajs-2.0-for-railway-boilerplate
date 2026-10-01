import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { canUseCart } from "../../helpers/cart-access"
import { createRentalsWorkflow } from "../../../../workflows/create-rentals"

export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const { cart_id } = req.params

  if (!(await canUseCart(req, cart_id))) {
    return res.status(404).json({ message: "Cart not found" })
  }


  const { result } = await createRentalsWorkflow(req.scope).run({
    input: {
      cart_id,
    },
  })

  res.json({
    type: "order",
    order: result.order,
  })
}

