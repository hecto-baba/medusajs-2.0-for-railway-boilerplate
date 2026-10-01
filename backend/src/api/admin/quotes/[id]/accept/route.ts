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
    fields: [
      "id",
      "status",
      "customer_id",
      "draft_order_id",
      "metadata",
      "draft_order.*",
      "cart.*",
    ],
    filters: { id: req.params.id },
  })

  if (!quote) {
    return res.status(404).json({ message: "Quote not found" })
  }

  // Update order status if draft order exists
  if (quote.draft_order_id) {
    try {
      await orderModuleService.updateOrders({
        id: quote.draft_order_id,
        is_draft_order: false,
        status: OrderStatus.PENDING,
      })
    } catch (err: any) {
      console.warn("Could not update order status on quote accept:", err?.message)
    }
  }

  // Mark quote as accepted
  const updatedQuote = await quoteModule.updateQuotes({
    id: quote.id,
    status: "accepted",
  })

  return res.json({
    success: true,
    quote: updatedQuote,
    order_id: quote.draft_order_id,
  })
}

