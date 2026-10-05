import { randomUUID } from "crypto"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { QUOTE_MODULE } from "../../../../../modules/quote"
import { assertVendorOwnsQuote } from "../../../shared/ownership-scope"

const MAX_TEXT_LENGTH = 2000
const MAX_REF_LENGTH = 300
const MAX_MESSAGES = 200

const optionalString = (value: unknown, max: number): string | null =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  // Also returns the quote's current metadata, so there is no second read.
  const owned = await assertVendorOwnsQuote(req, req.params.id)

  const body = (req.body || {}) as Record<string, unknown>
  const text = optionalString(body.text, MAX_TEXT_LENGTH + 1)

  if (!text) {
    return res.status(400).json({ message: "Message text is required" })
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return res
      .status(400)
      .json({ message: `Message must be ${MAX_TEXT_LENGTH} characters or fewer` })
  }

  const existingMeta = owned.metadata || {}
  const existingMessages = Array.isArray(existingMeta.messages)
    ? existingMeta.messages
    : []

  if (existingMessages.length >= MAX_MESSAGES) {
    return res
      .status(400)
      .json({ message: "This quote has reached its message limit" })
  }

  // The sender is always set here, never taken from the request.
  const newMessage = {
    id: `msg_${randomUUID()}`,
    sender: "merchant",
    text,
    item_id: optionalString(body.item_id, MAX_REF_LENGTH),
    item_title: optionalString(body.item_title, MAX_REF_LENGTH),
    created_at: new Date().toISOString(),
  }

  const messages = [...existingMessages, newMessage]

  const quoteModule = req.scope.resolve(QUOTE_MODULE) as any
  await quoteModule.updateQuotes({
    id: req.params.id,
    metadata: { ...existingMeta, messages },
  })

  return res.status(201).json({ message: newMessage, messages })
}
