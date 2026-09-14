import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { getOrdersListWorkflow } from "@medusajs/medusa/core-flows"

export const GetVendorOrdersSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

/**
 * Lists the calling vendor's orders with strict cross-vendor data privacy and pagination.
 *
 * Scoping ensures:
 * 1. Only orders containing products belonging to the calling vendor are returned.
 * 2. In multi-vendor carts, only line items belonging to THIS vendor are exposed.
 * 3. Line items and financials belonging to other vendors are redacted.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { limit, offset } = req.validatedQuery as unknown as z.infer<
    typeof GetVendorOrdersSchema
  >

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.id", "vendor.products.id", "vendor.orders.*"],
    filters: { id: [req.auth_context.actor_id] },
  })

  if (!vendorAdmin?.vendor) {
    res.status(404).json({ message: "Vendor profile not found." })
    return
  }

  const vendorProductIds = new Set<string>(
    (vendorAdmin.vendor.products || [])
      .map((p: any) => p?.id)
      .filter((id: any) => typeof id === "string" && id.length > 0)
  )

  const allOrders = vendorAdmin.vendor.orders ?? []

  const sortedIds = allOrders
    .filter(Boolean)
    .sort((a, b) =>
      new Date(b!.created_at as string).getTime() -
      new Date(a!.created_at as string).getTime()
    )
    .map((order) => order!.id)
    .filter((id: any) => typeof id === "string" && id.length > 0)

  const count = sortedIds.length
  const pageIds = sortedIds.slice(offset, offset + limit)

  // If vendor has no linked orders or no products, short-circuit immediately
  if (!pageIds.length || !vendorProductIds.size) {
    res.json({ orders: [], count, limit, offset })
    return
  }

  const { result: rawOrders } = await getOrdersListWorkflow(req.scope).run({
    input: {
      fields: [
        "id",
        "display_id",
        "status",
        "created_at",
        "currency_code",
        "total",
        "subtotal",
        "shipping_total",
        "tax_total",
        "customer.*",
        "sales_channel.*",
        "items.*",
        "items.tax_lines",
        "items.adjustments",
        "items.variant",
        "items.variant.product",
        "items.detail",
        "shipping_methods",
        "payment_collections",
        "fulfillments",
        "customer.first_name",
        "customer.last_name",
        "customer.email",
      ],
      variables: {
        filters: { id: pageIds },
      },
    },
  })

  const orderRows = Array.isArray(rawOrders)
    ? rawOrders
    : (rawOrders as any)?.rows || []

  // Filter out any line items that do not belong to this vendor's catalog
  const scopedOrders = orderRows
    .map((order: any) => {
      const vendorItems = (order.items || []).filter((item: any) => {
        const itemProductId = item.product_id || item.variant?.product_id || item.variant?.product?.id
        return itemProductId && vendorProductIds.has(itemProductId)
      })

      if (!vendorItems.length) {
        return null
      }

      // Calculate vendor-specific subtotal (in minor units)
      const vendorSubtotal = vendorItems.reduce((acc: number, item: any) => {
        const unitPrice = Number(item.unit_price) || 0
        const quantity = Number(item.quantity) || 1
        return acc + unitPrice * quantity
      }, 0)

      return {
        ...order,
        items: vendorItems,
        // Scoped financials so the vendor only sees their own sales volume
        subtotal: vendorSubtotal,
        total: vendorSubtotal,
      }
    })
    .filter(Boolean)

  res.json({ orders: scopedOrders, count, limit, offset })
}


