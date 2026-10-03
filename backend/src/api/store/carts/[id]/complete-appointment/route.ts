import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { canUseCart } from "../../../helpers/cart-access"
import { completeCartWithAppointmentWorkflow } from "../../../../../workflows/complete-cart-with-appointment"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params

  if (!(await canUseCart(req, id))) {
    return res.status(404).json({ message: "Cart not found" })
  }


  const { result } = await completeCartWithAppointmentWorkflow(req.scope).run({
    input: { cart_id: id },
  })

  res.json({ type: "order", order: result.order })
}
