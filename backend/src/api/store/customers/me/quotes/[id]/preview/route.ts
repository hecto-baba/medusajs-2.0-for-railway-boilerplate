import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
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
      "order_change_id",
      "cart_id",
      "created_at",
      "customer.*",
      "draft_order.*",
      "draft_order.items.*",
      "cart.*",
      "cart.items.*",
    ],
    filters: {
      id: req.params.id,
      customer_id: req.auth_context.actor_id,
    },
  })

  if (!quote) {
    return res.status(404).json({ message: "Quote not found" })
  }

  let orderPreview = null
  if (quote.draft_order_id) {
    try {
      orderPreview = await orderModuleService.previewOrderChange(quote.draft_order_id)
    } catch (e: any) {
      // preview can be empty or not available yet
    }
  }

  return res.json({
    quote,
    order_preview: orderPreview,
  })
}
