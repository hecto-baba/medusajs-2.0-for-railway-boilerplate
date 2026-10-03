import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Scopes an order to the calling seller.
 *
 * One cart yields ONE order today, and Medusa allows one seller per order link, so
 * an order can hold items of several sellers while being linked to one. The seller
 * is shown only their own items, with the subtotal and total of those items.
 *
 * When the order is MIXED (it has items that are not the seller's), the whole-order
 * figures cannot be shown, because they include other sellers' items: the payment
 * collections, shipping methods and fulfillments of the whole order, and the
 * shipping, tax and discount totals. They are withheld, never recomputed. An order
 * that is entirely the seller's is returned as before.
 *
 * This is interim. Phase 3 of docs/tenant-isolation-and-multi-tenancy.md creates
 * one order per seller, after which an order is never mixed.
 *
 * An item with no product at all (a custom line item, for example on a draft order
 * the seller converted) is the seller's own: only an item whose product belongs to
 * someone else makes an order mixed.
 *
 * Returns null when the order has no items for the seller.
 */

type OrderItem = {
  id?: string
  product_id?: string | null
  unit_price?: unknown
  quantity?: unknown
  variant?: { product_id?: string | null; product?: { id?: string | null } | null } | null
}

type ScopableOrder = {
  items?: OrderItem[] | null
  [key: string]: unknown
}

const productIdOf = (item: OrderItem): string | null | undefined =>
  item.product_id || item.variant?.product_id || item.variant?.product?.id

export const scopeOrderToVendor = <T extends ScopableOrder>(
  order: T,
  vendorProductIds: Set<string>
): (T & { is_mixed: boolean }) | null => {
  const allItems = order.items ?? []
  const items = allItems.filter((item) => {
    const productId = productIdOf(item)
    return !productId || vendorProductIds.has(productId)
  })

  if (!items.length) {
    return null
  }

  const subtotal = items.reduce(
    (sum, item) => sum + (Number(item.unit_price) || 0) * (Number(item.quantity) || 1),
    0
  )

  const scoped = { ...order, items, subtotal, total: subtotal }
  const mixed = items.length !== allItems.length

  if (!mixed) {
    return { ...scoped, is_mixed: false }
  }

  return {
    ...scoped,
    is_mixed: true,
    payment_collections: [],
    shipping_methods: [],
    fulfillments: [],
    shipping_total: null,
    tax_total: null,
    discount_total: null,
  } as T & { is_mixed: boolean }
}

/**
 * A seller's CHILD order (see lib/split-order.ts) has no customer and no payment
 * of its own: the buyer paid once, on the parent. So that the seller's screens
 * still work, fill in
 *  - customer: the buyer's name and email from the order's shipping address
 *    (no customer record is attached, only the id kept in metadata)
 *  - payment_collections: only the STATUS of the parent's payment ("is it paid?"),
 *    never its amounts, which cover other sellers' items too
 * Orders that are not child orders pass through unchanged.
 */
export const decorateSplitChildren = async <T extends Record<string, any>>(
  container: MedusaContainer,
  orders: T[]
): Promise<T[]> => {
  const children = orders.filter((order) => order?.metadata?.split_child)
  if (!children.length) {
    return orders
  }

  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const parentIds = [...new Set(children.map((order) => order.metadata.parent_order_id as string))]
  const { data: parents } = await query.graph({
    entity: "order",
    fields: ["id", "payment_collections.status"],
    filters: { id: parentIds },
  })
  const parentStatus = new Map<string, string>(
    (parents ?? []).map((parent: any) => [parent.id, parent.payment_collections?.[0]?.status ?? "not_paid"])
  )

  return orders.map((order) => {
    if (!order?.metadata?.split_child) {
      return order
    }
    const address = order.shipping_address ?? {}
    return {
      ...order,
      customer: {
        id: order.metadata.buyer_customer_id ?? null,
        email: order.email ?? null,
        first_name: address.first_name ?? null,
        last_name: address.last_name ?? null,
      },
      payment_collections: [{ status: parentStatus.get(order.metadata.parent_order_id) ?? "not_paid" }],
    }
  })
}
