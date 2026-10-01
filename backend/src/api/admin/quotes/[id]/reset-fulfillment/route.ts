import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { QUOTE_MODULE } from "../../../../../modules/quote"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const quoteModule = req.scope.resolve(QUOTE_MODULE) as any
  const { id } = req.params

  const quote = await quoteModule.retrieveQuote(id)
  if (!quote) {
    return res.status(404).json({ message: "Quote not found" })
  }

  await quoteModule.updateQuotes({
    id,
    metadata: {
      ...(quote.metadata || {}),
      fulfillment_status: "not_fulfilled",
      dispatched_at: null,
      delivered_at: null,
      tracking_number: null,
      carrier: null,
    },
  })

  return res.json({ success: true, fulfillment_status: "not_fulfilled" })
}

