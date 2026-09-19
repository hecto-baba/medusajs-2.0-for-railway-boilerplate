import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { completeCartWithAppointmentWorkflow } from "../../../../../workflows/complete-cart-with-appointment"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params

  const { result } = await completeCartWithAppointmentWorkflow(req.scope).run({
    input: { cart_id: id },
  })

  res.json({ type: "order", order: result.order })
}
