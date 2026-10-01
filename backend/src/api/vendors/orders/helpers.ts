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
