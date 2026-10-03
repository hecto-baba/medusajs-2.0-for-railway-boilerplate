import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { canUseCart } from "../../../helpers/cart-access"
import { completeCartDigitalWorkflow } from "../../../../../workflows/create-digital-product-order"

export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  if (!(await canUseCart(req, req.params.id))) {
    return res.status(404).json({ message: "Cart not found" })
  }

  const { result } = await completeCartDigitalWorkflow(req.scope).run({
    input: {
      id: req.params.id,
    },
  })

  res.json({
    type: "order",
    order: result,
  })
}
