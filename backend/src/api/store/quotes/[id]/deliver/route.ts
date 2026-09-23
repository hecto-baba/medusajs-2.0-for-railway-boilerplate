import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules, OrderStatus } from "@medusajs/framework/utils"
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

  const deliveredAt = new Date().toISOString()

  if (quote.draft_order_id) {
    try {
      await orderModuleService.updateOrders({
        id: quote.draft_order_id,
        fulfillment_status: "delivered",
        status: OrderStatus.COMPLETED,
      })
    } catch (err: any) {
      console.warn("Could not update order fulfillment status to delivered:", err?.message)
    }
  }

  await quoteModule.updateQuotes({
    id: quote.id,
    metadata: {
      ...(quote.metadata || {}),
      fulfillment_status: "delivered",
      delivered_at: deliveredAt,
    },
  })

  return res.json({
    success: true,
    fulfillment_status: "delivered",
    delivered_at: deliveredAt,
  })
}

