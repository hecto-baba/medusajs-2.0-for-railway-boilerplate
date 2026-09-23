import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { completeCartDigitalWorkflow } from "../../../../../workflows/create-digital-product-order"

export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
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
