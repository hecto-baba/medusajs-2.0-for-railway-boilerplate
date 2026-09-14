import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [vendor],
  } = await query.graph({
    entity: "vendor",
    fields: [
      "id",
      "name",
      "handle",
      "logo",
      "created_at",
      "updated_at",
      "admins.*",
      "products.*",
      "products.variants.*",
      "products.variants.prices.*",
      "products.images.*",
      "orders.*",
    ],
    filters: { id: [id] },
  })

  if (!vendor) {
    res.status(404).json({ message: "Vendor not found." })
    return
  }

  const vendorProductIds = new Set<string>(
    (vendor.products || [])
      .map((p: any) => p?.id)
      .filter((pid: any) => typeof pid === "string" && pid.length > 0)
  )

  const linkedOrderIds = Array.from(
    new Set<string>(
      (vendor.orders || [])
        .map((o: any) => o?.id)
        .filter((oid: any) => typeof oid === "string" && oid.length > 0)
    )
  )

  let orders: any[] = []

  if (linkedOrderIds.length > 0) {
    try {
      const { data: matchedOrders } = await query.graph({
        entity: "order",
        fields: [
          "id",
          "display_id",
          "status",
          "created_at",
          "currency_code",
          "total",
          "items.*",
          "items.variant.product_id",
          "customer.email",
          "customer.first_name",
          "customer.last_name",
        ],
        filters: { id: linkedOrderIds },
      })
      orders = matchedOrders || []
    } catch {
      orders = []
    }
  } else if (vendorProductIds.size > 0) {
    // If no direct link exists yet, verify if any orders contain products belonging to this vendor
    try {
      const { data: allOrders } = await query.graph({
        entity: "order",
        fields: [
          "id",
          "display_id",
          "status",
          "created_at",
          "currency_code",
          "total",
          "items.*",
          "items.variant.product_id",
          "customer.email",
          "customer.first_name",
          "customer.last_name",
        ],
        pagination: { take: 50, order: { created_at: "DESC" } },
      })

      orders = (allOrders || []).filter((ord: any) =>
        (ord.items || []).some((item: any) => {
          const itemProdId = item?.product_id || item?.variant?.product_id
          return typeof itemProdId === "string" && vendorProductIds.has(itemProdId)
        })
      )
    } catch {
      orders = []
    }
  }

  res.json({
    vendor,
    orders,
  })
}


