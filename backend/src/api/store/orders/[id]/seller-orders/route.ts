import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MARKETPLACE_MODULE } from "../../../../../modules/marketplace"
import { canBuyerSeeOrder } from "../../../helpers/order-access"

/**
 * Who is shipping what for a placed order (Phase 3, step 7).
 *
 * The buyer pays once, on the order they see (the parent). When it holds several
 * sellers' items, each seller fulfils a child order of their own; this lists
 * those, one per seller, so the confirmation page and the order page can show
 * "sold and shipped by ...". An order with one seller (or none) returns an empty
 * list: the order itself is that seller's.
 *
 * Returns only what a buyer needs (seller name, items, status, totals); never
 * the ledger or seller contact details.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const query: any = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const marketplace: any = req.scope.resolve(MARKETPLACE_MODULE)

  // Only the buyer's own order (or a guest's): the same rule as the order itself.
  const {
    data: [parent],
  } = await query.graph({ entity: "order", fields: ["id", "customer_id", "metadata"], filters: { id } })
  if (!parent || !(await canBuyerSeeOrder(req, parent))) {
    res.status(404).json({ message: "Order not found" })
    return
  }

  const splits: any[] = await marketplace.listVendorOrderSplits({ parent_order_id: id })
  if (!splits.length) {
    res.json({ seller_orders: [] })
    return
  }

  const { data: vendors } = await query.graph({
    entity: "vendor",
    fields: ["id", "name"],
    filters: { id: splits.map((split) => split.vendor_id) },
  })
  const vendorName = new Map<string, string>((vendors ?? []).map((v: any) => [v.id, v.name]))

  const { data: children } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "status",
      "currency_code",
      "total",
      "items.title",
      "items.thumbnail",
      "items.detail.quantity",
      "fulfillments.shipped_at",
      "fulfillments.delivered_at",
      "fulfillments.canceled_at",
    ],
    filters: { id: splits.map((split) => split.child_order_id) },
  })
  const byId = new Map<string, any>((children ?? []).map((child: any) => [child.id, child]))

  const fulfillmentStatus = (fulfillments: any[]) => {
    const active = (fulfillments ?? []).filter((f) => !f.canceled_at)
    if (!active.length) return "not_fulfilled"
    if (active.some((f) => f.delivered_at)) return "delivered"
    if (active.some((f) => f.shipped_at)) return "shipped"
    return "fulfilled"
  }

  res.json({
    seller_orders: splits.map((split) => {
      const child = byId.get(split.child_order_id)
      return {
        id: split.child_order_id,
        display_id: child?.display_id ?? null,
        seller: { id: split.vendor_id, name: vendorName.get(split.vendor_id) ?? null },
        status: child?.status ?? null,
        fulfillment_status: fulfillmentStatus(child?.fulfillments),
        currency_code: split.currency_code,
        total: split.total,
        items: (child?.items ?? []).map((item: any) => ({
          title: item.title,
          thumbnail: item.thumbnail ?? null,
          quantity: Number(item.detail?.quantity ?? item.quantity ?? 0),
        })),
      }
    }),
  })
}
