import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { QUOTE_MODULE } from "../../../../../modules/quote"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const quoteModule = req.scope.resolve(QUOTE_MODULE) as any

  const {
    data: [quote],
  } = await query.graph({
    entity: "quote",
    fields: ["id", "metadata"],
    filters: { id: req.params.id },
  })

  if (!quote) {
    return res.status(404).json({ message: "Quote not found" })
  }

  const { text, item_id, item_title } = (req.body || {}) as {
    text: string
    item_id?: string
    item_title?: string
  }

  if (!text || !text.trim()) {
    return res.status(400).json({ message: "Message text is required" })
  }

  const existingMeta = (quote.metadata || {}) as any
  const existingMessages = existingMeta.messages || []

  const newMessage = {
    id: `msg_${Date.now()}`,
    sender: "merchant",
    sender_name: "Merchant Support",
    text: text.trim(),
    item_id: item_id || null,
    item_title: item_title || null,
    created_at: new Date().toISOString(),
  }

  const updatedMessages = [...existingMessages, newMessage]

  await quoteModule.updateQuotes({
    id: quote.id,
    metadata: {
      ...existingMeta,
      messages: updatedMessages,
    },
  })

  return res.status(201).json({
    message: newMessage,
    messages: updatedMessages,
  })
}
