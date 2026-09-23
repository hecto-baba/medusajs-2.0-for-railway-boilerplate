import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { merchantSendQuoteWorkflow } from "../../../../../workflows/merchant-send-quote"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { result } = await merchantSendQuoteWorkflow(req.scope).run({
    input: {
      quote_id: req.params.id,
    },
  })

  return res.json(result || { success: true })
}
