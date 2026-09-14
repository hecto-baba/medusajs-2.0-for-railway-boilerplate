import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { deleteDraftOrdersWorkflow } from "@medusajs/medusa/core-flows"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const draftOrderId = req.params.id

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "status",
      "is_draft_order",
      "currency_code",
      "email",
      "total",
      "subtotal",
      "shipping_total",
      "tax_total",
      "discount_total",
      "created_at",
      "updated_at",
      "customer.*",
      "shipping_address.*",
      "billing_address.*",
      "items.*",
      "items.variant.*",
      "items.variant.product.*",
      "shipping_methods.*",
      "summary.*",
    ],
    filters: {
      id: draftOrderId,
      is_draft_order: true,
    },
  })

  if (!orders?.length) {
    res.status(404).json({ message: "Draft order not found." })
    return
  }

  res.json({ draft_order: orders[0] })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const draftOrderId = req.params.id

  await deleteDraftOrdersWorkflow(req.scope).run({
    input: { order_ids: [draftOrderId] },
  })

  res.json({ id: draftOrderId, object: "draft_order", deleted: true })
}
