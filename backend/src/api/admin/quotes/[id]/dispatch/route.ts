import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { QUOTE_MODULE } from "../../../../../modules/quote"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const quoteModule = req.scope.resolve(QUOTE_MODULE) as any
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const orderModuleService = req.scope.resolve(Modules.ORDER) as any

  const {
    data: [quote],
  } = await query.graph({
    entity: "quote",
    fields: ["id", "status", "customer_id", "draft_order_id", "metadata"],
    filters: { id: req.params.id },
  })

  if (!quote) {
    return res.status(404).json({ message: "Quote not found" })
  }

  const {
    carrier = "Express Freight Delivery",
    tracking_number,
    note,
  } = (req.body || {}) as {
    carrier?: string
    tracking_number?: string
    note?: string
  }

  const dispatchedAt = new Date().toISOString()
  const trackingNumber = tracking_number || `TRK-${Date.now().toString().slice(-6)}`

  if (quote.draft_order_id) {
    try {
      await orderModuleService.updateOrders({
        id: quote.draft_order_id,
        fulfillment_status: "shipped",
        metadata: {
          fulfillment_status: "shipped",
          dispatched_at: dispatchedAt,
          tracking_number: trackingNumber,
          carrier,
        },
      })
    } catch (err: any) {
      console.warn("Could not update order fulfillment status to shipped:", err?.message)
      console.warn("Could not update order fulfillment metadata:", err?.message)
    }
  }

  await quoteModule.updateQuotes({
    id: quote.id,
    metadata: {
      ...(quote.metadata || {}),
      fulfillment_status: "shipped",
      dispatched_at: dispatchedAt,
      tracking_number: trackingNumber,
      carrier,
      dispatch_note: note || "Dispatched to buyer delivery address.",
    },
  })

  return res.json({
    success: true,
    fulfillment_status: "shipped",
    dispatched_at: dispatchedAt,
    tracking_number: trackingNumber,
    carrier,
  })
}

