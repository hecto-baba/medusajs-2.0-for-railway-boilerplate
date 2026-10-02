import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * Lists enquiries for one product - the query the product.details widget
 * uses. Nested under the product (mirrors rental-config/appointment-config)
 * rather than a flat /admin/enquiries?product_id=, since every read here is
 * already scoped to one product's admin page.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const query = req.scope.resolve("query")

  // A missing product must 404, not silently render as "zero enquiries" -
  // matches admin/enquiries/[id]/route.ts's own not-found handling.
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id"],
    filters: { id },
  })

  if (!products?.length) {
    res.status(404).json({ message: "Product not found." })
    return
  }

  const { data: enquiries } = await query.graph({
    entity: "enquiry",
    fields: [
      "id",
      "product_id",
      "customer_id",
      "customer_email",
      "message",
      "custom_field_answers",
      "custom_fields_snapshot",
      "reply",
      "status",
      "responded_at",
      "created_at",
      "updated_at",
    ],
    filters: { product_id: id },
  })

  res.json({
    enquiries: enquiries.sort(
      (a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
    ),
    count: enquiries.length,
  })
}
