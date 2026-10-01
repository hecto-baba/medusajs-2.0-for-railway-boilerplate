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

  if (quote.status !== "accepted") {
    return res.status(400).json({ message: "Quote must be accepted before payment" })
  }

  const { payment_method = "B2B Instant Payment (Card / Wire)" } = (req.body || {}) as {
    payment_method?: string
  }

  const paidAt = new Date().toISOString()

  if (quote.draft_order_id) {
    try {
      await orderModuleService.updateOrders({
        id: quote.draft_order_id,
        metadata: {
          payment_status: "paid",
          paid_at: paidAt,
          payment_method,
        },
      })
    } catch (err: any) {
      console.warn("Could not update order payment status:", err?.message)
    }
  }

  await quoteModule.updateQuotes({
    id: quote.id,
    metadata: {
      ...(quote.metadata || {}),
      payment_status: "paid",
      payment_method,
      paid_at: paidAt,
    },
  })

  return res.json({
    success: true,
    payment_status: "paid",
    paid_at: paidAt,
    payment_method,
  })
}
