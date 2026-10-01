import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const query = req.scope.resolve("query")

  const { data: eois } = await query.graph({
    entity: "eoi",
    fields: [
      "id",
      "product_id",
      "variant_id",
      "customer_email",
      "line_item_id",
      "value_type",
      "value_amount",
      "quoted_unit_price",
      "eoi_charged_amount",
      "remaining_amount",
      "status",
      "created_at",
      "product_variant.id",
      "product_variant.title",
      "product_variant.product.id",
      "product_variant.product.title",
      "product_variant.product.thumbnail",
    ],
    filters: {
      order_id: id,
    },
  })

  res.json({ eois })
}
