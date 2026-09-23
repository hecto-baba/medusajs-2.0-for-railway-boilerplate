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
  q: z.string().optional(),
  order: z.string().optional(),
  status: z.string().optional(),
  payment_status: z.string().optional(),
  fulfillment_status: z.string().optional(),
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
  const {
    limit,
    offset,
    q,
    order,
    status,
    payment_status,
    fulfillment_status,
  } = req.validatedQuery as unknown as z.infer<typeof GetVendorOrdersSchema>

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
  const allOrderIds = allOrders
    .filter(Boolean)
    .map((o) => o!.id)
    .filter((id: any) => typeof id === "string" && id.length > 0)

  // If vendor has no linked orders or no products, short-circuit immediately
  if (!allOrderIds.length || !vendorProductIds.size) {
    res.json({ orders: [], count: 0, limit, offset })
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
        filters: { id: allOrderIds },
      },
    },
  })

  const orderRows = Array.isArray(rawOrders)
    ? rawOrders
    : (rawOrders as any)?.rows || []

  // Filter out any line items that do not belong to this vendor's catalog
  const scopedOrders = orderRows
    .map((rawOrder: any) => {
      const vendorItems = (rawOrder.items || []).filter((item: any) => {
        const itemProductId =
          item.product_id ||
          item.variant?.product_id ||
          item.variant?.product?.id
        return itemProductId && vendorProductIds.has(itemProductId)
      })

      if (!vendorItems.length) {
        return null
      }

      // Calculate vendor-specific subtotal
      const vendorSubtotal = vendorItems.reduce((acc: number, item: any) => {
        const unitPrice = Number(item.unit_price) || 0
        const quantity = Number(item.quantity) || 1
        return acc + unitPrice * quantity
      }, 0)

      return {
        ...rawOrder,
        items: vendorItems,
        subtotal: vendorSubtotal,
        total: vendorSubtotal,
      }
    })
    .filter(Boolean)

  // Filter by search query
  let filtered = scopedOrders
  if (q) {
    const lower = q.toLowerCase()
    filtered = filtered.filter(
      (o: any) =>
        o.display_id?.toString().includes(lower) ||
        o.email?.toLowerCase().includes(lower) ||
        o.customer?.first_name?.toLowerCase().includes(lower) ||
        o.customer?.last_name?.toLowerCase().includes(lower) ||
        o.customer?.email?.toLowerCase().includes(lower)
    )
  }

  // Filter by order status
  if (status && status !== "all") {
    filtered = filtered.filter((o: any) => o.status === status)
  }

  // Filter by payment status
  if (payment_status && payment_status !== "all") {
    filtered = filtered.filter((o: any) => {
      const pStatus = o.payment_collections?.[0]?.status ?? "not_paid"
      return pStatus === payment_status
    })
  }

  // Filter by fulfillment status
  if (fulfillment_status && fulfillment_status !== "all") {
    filtered = filtered.filter((o: any) => {
      const fulfillments = o.fulfillments ?? []
      const fStatus = !fulfillments.length
        ? "not_fulfilled"
        : fulfillments.some((f: any) => f.delivered_at)
          ? "delivered"
          : fulfillments.some((f: any) => f.shipped_at)
            ? "shipped"
            : "fulfilled"
      return fStatus === fulfillment_status
    })
  }

  // Sort orders
  const sortField = order ? (order.startsWith("-") ? order.slice(1) : order) : "created_at"
  const isDesc = order ? order.startsWith("-") : true // default created_at DESC

  const sorted = filtered.sort((a: any, b: any) => {
    let valA = a[sortField]
    let valB = b[sortField]

    if (sortField === "created_at") {
      valA = new Date(valA || 0).getTime()
      valB = new Date(valB || 0).getTime()
    } else if (sortField === "display_id" || sortField === "total") {
      valA = Number(valA) || 0
      valB = Number(valB) || 0
    }

    if (valA < valB) return isDesc ? 1 : -1
    if (valA > valB) return isDesc ? -1 : 1
    return 0
  })

  const count = sorted.length
  const paged = sorted.slice(offset, offset + limit)

  res.json({ orders: paged, count, limit, offset })
}


