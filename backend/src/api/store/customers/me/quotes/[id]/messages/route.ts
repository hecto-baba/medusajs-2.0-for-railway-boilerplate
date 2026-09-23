import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { QUOTE_MODULE } from "../../../../../../../modules/quote"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
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

  const { text } = (req.body || {}) as { text: string }
  if (!text || !text.trim()) {
    return res.status(400).json({ message: "Message text is required" })
  }

  const existingMeta = (quote.metadata || {}) as any
  const existingMessages = existingMeta.messages || []

  // Check if buyer counter-proposed a price (e.g., "can u make 750")
  let targetPrice = existingMeta.target_price
  const priceMatch = text.match(/(?:(?:make(?:\sit)?|offer|rate|price|for)\s*)?(\d+(?:\.\d{1,2})?)/i)
  if (priceMatch && priceMatch[1]) {
    const parsed = parseFloat(priceMatch[1])
    if (parsed > 0 && parsed < 100000) {
      targetPrice = parsed
    }
  }

  const newMessage = {
    id: `msg_${Date.now()}`,
    sender: "customer",
    sender_name: "Buyer",
    text: text.trim(),
    created_at: new Date().toISOString(),
  }

  const updatedMessages = [...existingMessages, newMessage]

  // Transition back to pending_merchant so the merchant in Admin sees the buyer's reply and counter-offer!
  await quoteModule.updateQuotes({
    id: quote.id,
    status: "pending_merchant",
    metadata: {
      ...existingMeta,
      target_price: targetPrice,
      messages: updatedMessages,
    },
  })

  return res.status(201).json({
    success: true,
    message: newMessage,
    messages: updatedMessages,
  })
}
