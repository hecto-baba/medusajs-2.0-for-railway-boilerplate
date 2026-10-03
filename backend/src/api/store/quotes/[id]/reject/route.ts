import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { QUOTE_MODULE } from "../../../../../modules/quote"
import { canAccessQuote } from "../../../helpers/quote-access"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const quoteModule = req.scope.resolve(QUOTE_MODULE) as any
  let quote: any = null
  try {
    quote = await quoteModule.retrieveQuote(req.params.id)
  } catch {
    return res.status(404).json({ message: "Quote not found" })
  }

  if (!quote) {
    return res.status(404).json({ message: "Quote not found" })
  }

  if (!(await canAccessQuote(req, quote))) {
    return res.status(404).json({ message: "Quote not found" })
  }

  try {
    await quoteModule.updateQuotes({
      id: req.params.id,
      status: "customer_rejected",
    })
    return res.json({ success: true })
  } catch (err: any) {
    return res.status(400).json({ message: err.message || "Failed to reject quote" })
  }
}