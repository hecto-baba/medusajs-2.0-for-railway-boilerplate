import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { getOrdersListWorkflow } from "@medusajs/medusa/core-flows"
import { decorateSplitChildren, scopeOrderToVendor } from "./helpers"

export const GetVendorOrdersSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().optional(),
  order: z.string().optional(),
  status: z.string().optional(),
  payment_status: z.string().optional(),
  fulfillment_status: z.string().optional(),
  region_id: z.string().optional(),
  sales_channel_id: z.string().optional(),
  created_at_gte: z.string().optional(),
  updated_at_gte: z.string().optional(),
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
    region_id,
    sales_channel_id,
    created_at_gte,
    updated_at_gte,
  } = req.validatedQuery as unknown as z.infer<typeof GetVendorOrdersSchema>

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    // Ids only: the order rows themselves are loaded below, a page at a time.
    fields: ["vendor.id", "vendor.products.id", "vendor.orders.id"],
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

  const allOrderIds = (vendorAdmin.vendor.orders ?? [])
    .filter(Boolean)
    .map((o) => o!.id)
    .filter((id: any) => typeof id === "string" && id.length > 0)

  // If vendor has no linked orders or no products, short-circuit immediately
  if (!allOrderIds.length || !vendorProductIds.size) {
    res.json({ orders: [], count: 0, limit, offset })
    return
  }

  const sortField = order ? (order.startsWith("-") ? order.slice(1) : order) : "created_at"
  const isDesc = order ? order.startsWith("-") : true // default created_at DESC

  // Everything the database can filter, it filters.
  const dbFilters: Record<string, unknown> = { id: allOrderIds }
  if (status && status !== "all") dbFilters.status = status
  if (region_id) dbFilters.region_id = region_id
  if (sales_channel_id) dbFilters.sales_channel_id = sales_channel_id
  if (created_at_gte) dbFilters.created_at = { $gte: new Date(created_at_gte) }
  if (updated_at_gte) dbFilters.updated_at = { $gte: new Date(updated_at_gte) }

  const wantsPayment = !!payment_status && payment_status !== "all"
  const wantsFulfillment = !!fulfillment_status && fulfillment_status !== "all"
  const sortsInDatabase = ["created_at", "updated_at", "display_id"].includes(sortField)

  // Free-text search, the derived payment and fulfillment statuses, and sorting by
  // a computed total cannot be done by the database, so those requests narrow the
  // list in memory over LIGHT rows. Every other request is paged by the database.
  const needsMemoryPass = !!q || wantsPayment || wantsFulfillment || !sortsInDatabase

  let pageIds: string[]
  let count: number

  if (!needsMemoryPass) {
    const { data: rows, metadata } = await query.graph({
      entity: "order",
      fields: ["id"],
      filters: dbFilters,
      pagination: { skip: offset, take: limit, order: { [sortField]: isDesc ? "DESC" : "ASC" } },
    })
    pageIds = rows.map((row: any) => row.id)
    count = metadata?.count ?? pageIds.length
  } else {
    const { data: lightRows } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "created_at",
        "updated_at",
        "total",
        "email",
        "shipping_address.first_name",
        "shipping_address.last_name",
        "customer.first_name",
        "customer.last_name",
        "customer.email",
        "payment_collections.status",
        "fulfillments.shipped_at",
        "fulfillments.delivered_at",
        "metadata",
      ],
      filters: dbFilters,
    })

    // Child orders get their payment status from the parent (see ./helpers.ts).
    let rows = (await decorateSplitChildren(req.scope, lightRows as any[])) as any[]

    if (q) {
      const lower = q.toLowerCase()
      rows = rows.filter(
        (o) =>
          o.display_id?.toString().includes(lower) ||
          o.email?.toLowerCase().includes(lower) ||
          o.customer?.first_name?.toLowerCase().includes(lower) ||
          o.customer?.last_name?.toLowerCase().includes(lower) ||
          o.customer?.email?.toLowerCase().includes(lower) ||
          // A seller's child order has no customer record; the buyer is on the address.
          o.shipping_address?.first_name?.toLowerCase().includes(lower) ||
          o.shipping_address?.last_name?.toLowerCase().includes(lower)
      )
    }

    if (wantsPayment) {
      rows = rows.filter((o) => {
        return (o.payment_collections?.[0]?.status ?? "not_paid") === payment_status
      })
    }

    if (wantsFulfillment) {
      rows = rows.filter((o) => {
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

    rows.sort((a, b) => {
      let valA = a[sortField]
      let valB = b[sortField]
      if (sortField === "created_at" || sortField === "updated_at") {
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

    count = rows.length
    pageIds = rows.slice(offset, offset + limit).map((row) => row.id)
  }

  if (!pageIds.length) {
    res.json({ orders: [], count, limit, offset })
    return
  }

  // Heavy fields, for the page only.
  const { result: rawOrders } = await getOrdersListWorkflow(req.scope).run({
    input: {
      fields: [
        "id",
        "display_id",
        "status",
        "created_at",
        "updated_at",
        "currency_code",
        "total",
        "subtotal",
        "shipping_total",
        "tax_total",
        "metadata",
        "email",
        "shipping_address.*",
        "customer.*",
        "sales_channel.*",
        "region_id",
        "items.*",
        "items.tax_lines",
        "items.adjustments",
        "items.variant",
        "items.variant.product",
        "items.detail",
        "shipping_methods",
        "payment_collections",
        "fulfillments",
      ],
      variables: {
        filters: { id: pageIds },
      },
    },
  })

  const orderRows = Array.isArray(rawOrders)
    ? rawOrders
    : (rawOrders as any)?.rows || []

  // Keep only this vendor's items, and withhold whole-order figures when the
  // order also holds other sellers' items (see ./helpers.ts).
  const scopedOrders = await decorateSplitChildren(
    req.scope,
    orderRows
      .map((rawOrder: any) => scopeOrderToVendor(rawOrder, vendorProductIds))
      .filter(Boolean)
  )

  // Keep the order the page was chosen in.
  const position = new Map(pageIds.map((id, index) => [id, index]))
  scopedOrders.sort((a: any, b: any) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0))

  res.json({ orders: scopedOrders, count, limit, offset })
}
