import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { QUOTE_MODULE } from "../../../../modules/quote"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const orderModuleService = req.scope.resolve(Modules.ORDER) as any
  const quoteModule = req.scope.resolve(QUOTE_MODULE) as any

  try {
    const {
      data: [quote],
    } = await query.graph({
      entity: "quote",
      fields: [
        "id",
        "status",
        "customer_id",
        "draft_order_id",
        "order_change_id",
        "cart_id",
        "metadata",
        "created_at",
        "customer.*",
        "draft_order.*",
        "draft_order.total",
        "draft_order.currency_code",
        "draft_order.items.*",
        "cart.*",
        "cart.total",
        "cart.currency_code",
        "cart.items.*",
      ],
      filters: {
        id: req.params.id,
      },
    })

    if (!quote) {
      return res.status(404).json({ message: "Quote not found" })
    }

    let orderPreview = null
    if (quote.draft_order_id) {
      try {
        orderPreview = await orderModuleService.previewOrderChange(quote.draft_order_id)
      } catch (e: any) {}
    }

    return res.json({
      quote,
      order_preview: orderPreview,
    })
  } catch (err: any) {
    try {
      const quote = await quoteModule.retrieveQuote(req.params.id)
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" })
      }
      return res.json({ quote })
    } catch {
      return res.status(404).json({ message: "Quote not found" })
    }
  }
}
