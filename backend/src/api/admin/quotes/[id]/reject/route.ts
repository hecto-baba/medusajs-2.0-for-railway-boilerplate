import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { merchantRejectQuoteWorkflow } from "../../../../../workflows/merchant-reject-quote"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { result } = await merchantRejectQuoteWorkflow(req.scope).run({
    input: {
      quote_id: req.params.id,
    },
  })

  return res.json(result || { success: true })
}
