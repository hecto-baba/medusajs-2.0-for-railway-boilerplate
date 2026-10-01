import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const {
      data: [order],
    } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "status",
        "fulfillment_status",
        "payment_status",
        "total",
        "subtotal",
        "discount_total",
        "shipping_total",
        "tax_total",
        "currency_code",
        "email",
        "created_at",
        "customer_id",
        "region_id",
        "items.*",
        "shipping_methods.*",
        "shipping_address.*",
        "billing_address.*",
        "payment_collections.*",
        "payment_collections.payments.*",
        "metadata",
      ],
      filters: { id: req.params.id },
    })

    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    return res.json({ order })
  } catch (err: any) {
    return res.status(500).json({ message: err.message || "Failed to retrieve order" })
  }
}

