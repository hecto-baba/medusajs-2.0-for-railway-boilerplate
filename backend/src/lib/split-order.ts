import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createOrdersWorkflow } from "@medusajs/medusa/core-flows"
import { MARKETPLACE_MODULE } from "../modules/marketplace"
import { loadProductSellers } from "./cart-shipping"
import { linkRestaurantDishesToSellers } from "./restaurant-dish-owner"
import { round, toNumber } from "./money"

/**
 * Seller orders (Phase 3, decision D5).
 *
 * The cart completes into ONE parent order that holds the buyer's payment, the
 * emails, tickets and so on. A seller must only see their own items, shipping
 * and money, and Medusa links an order to ONE seller only, so:
 *
 *  - every item belongs to the seller that owns its product
 *  - all items are one seller's  -> the parent order IS that seller's order
 *    (linked to the seller; nothing is split)
 *  - anything else (several sellers, or a seller's items next to platform items)
 *    -> one CHILD order per seller holds only that seller's items and the
 *    shipping methods that ship them, linked to the seller. The parent is linked
 *    to no seller, so no seller can open the whole order.
 *
 * Each child gets a vendor_order_split row: what the platform owes that seller
 * (decision D2: platform-held ledger; the buyer pays once, on the parent).
 *
 * Safe to run twice: a seller that already has a child for this parent is
 * skipped, so a failure half-way is repaired by running it again.
 */

export type SplitOrderResult = {
  mode: "none" | "single" | "split" | "child"
  created_child_ids: string[]
}

// An order line item keeps its quantity on the order-item detail record.
const quantityOf = (item: any): number => {
  const quantity = toNumber(item.detail?.quantity ?? item.quantity)
  if (!(quantity > 0)) {
    throw new Error(`Cannot copy a line item with no quantity: ${JSON.stringify(item)}`)
  }
  return quantity
}

const toTaxLines = (lines: any[] | undefined) =>
  (lines ?? []).map((line) => ({
    description: line.description ?? undefined,
    code: line.code,
    rate: toNumber(line.rate),
    provider_id: line.provider_id ?? undefined,
    tax_rate_id: line.tax_rate_id ?? undefined,
  }))

export const splitOrderBySeller = async (
  container: MedusaContainer,
  parentOrderId: string
): Promise<SplitOrderResult> => {
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const link: any = container.resolve(ContainerRegistrationKeys.LINK)
  const marketplace: any = container.resolve(MARKETPLACE_MODULE)

  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "metadata",
      "currency_code",
      "region_id",
      "customer_id",
      "sales_channel_id",
      "email",
      "locale",
      "shipping_address.*",
      "billing_address.*",
      "items.id",
      "items.title",
      "items.subtitle",
      "items.thumbnail",
      "items.quantity",
      "items.detail.quantity",
      "items.unit_price",
      "items.is_tax_inclusive",
      "items.is_discountable",
      "items.requires_shipping",
      "items.product_id",
      "items.product_title",
      "items.product_description",
      "items.product_subtitle",
      "items.product_type",
      "items.product_collection",
      "items.product_handle",
      "items.variant_id",
      "items.variant_sku",
      "items.variant_barcode",
      "items.variant_title",
      "items.variant_option_values",
      "items.metadata",
      "items.tax_lines.*",
      "shipping_methods.id",
      "shipping_methods.name",
      "shipping_methods.amount",
      "shipping_methods.is_tax_inclusive",
      "shipping_methods.shipping_option_id",
      "shipping_methods.data",
      "shipping_methods.tax_lines.*",
    ],
    filters: { id: parentOrderId },
  })

  // A child order is never split again.
  if (!order || order.metadata?.split_child) {
    return { mode: "child", created_child_ids: [] }
  }

  const items: any[] = order.items ?? []
  if (!items.length) {
    return { mode: "none", created_child_ids: [] }
  }

  // The seller of each item; platform items have none.
  const productIds = items.map((item) => item.product_id).filter((id): id is string => !!id)
  // Dishes added by an admin may not be linked to their restaurant's seller yet.
  // This is a repair step: if it fails, carry on with the links that already exist
  // rather than leave the seller without their order.
  await linkRestaurantDishesToSellers(container, productIds).catch((error) => {
    console.error("Could not link restaurant dishes to their seller:", error)
  })
  const productSellers = await loadProductSellers(container, productIds)
  // A rental adds a separate "Security Deposit" line with no product. It belongs to
  // the seller of the rental item in the same rental group, not to the platform.
  const groupSeller = new Map<string, string>()
  for (const item of items) {
    const groupId = item.metadata?.rental_group_id
    const seller = productSellers.get(item.product_id)?.id
    if (groupId && seller) {
      groupSeller.set(groupId, seller)
    }
  }
  const sellerOf = (item: any): string | null =>
    productSellers.get(item.product_id)?.id ??
    (item.metadata?.rental_group_id ? groupSeller.get(item.metadata.rental_group_id) ?? null : null)

  const sellerIds = [...new Set(items.map(sellerOf).filter((id): id is string => !!id))]
  if (!sellerIds.length) {
    return { mode: "none", created_child_ids: [] }
  }

  const everyItemIsOneSellers = sellerIds.length === 1 && items.every((item) => sellerOf(item) === sellerIds[0])

  // One seller's order: the parent itself is their order.
  if (everyItemIsOneSellers) {
    const {
      data: [vendor],
    } = await query.graph({ entity: "vendor", fields: ["id", "orders.id"], filters: { id: [sellerIds[0]] } })
    const linked = (vendor?.orders ?? []).some((o: any) => o?.id === order.id)
    if (!linked) {
      await link.create({
        [MARKETPLACE_MODULE]: { vendor_id: sellerIds[0] },
        [Modules.ORDER]: { order_id: order.id },
      })
    }
    return { mode: "single", created_child_ids: [] }
  }

  // Shipping methods go to the seller whose shipping profile their option uses;
  // methods on a shared platform profile stay on the parent only.
  const { data: vendorsWithProfiles } = await query.graph({
    entity: "vendor",
    fields: ["id", "shipping_profiles.id"],
    filters: { id: sellerIds },
  })
  const profileOwner = new Map<string, string>()
  for (const vendor of vendorsWithProfiles as any[]) {
    for (const profile of vendor.shipping_profiles ?? []) {
      profileOwner.set(profile.id, vendor.id)
    }
  }

  // The profile of each shipping method's option (read from the option itself: the
  // order's shipping method does not expose it).
  const optionIds = ((order.shipping_methods ?? []) as any[])
    .map((method) => method.shipping_option_id)
    .filter((id): id is string => !!id)
  const optionProfile = new Map<string, string>()
  if (optionIds.length) {
    const { data: options } = await query.graph({
      entity: "shipping_option",
      fields: ["id", "shipping_profile_id"],
      filters: { id: optionIds },
    })
    for (const option of options as any[]) {
      optionProfile.set(option.id, option.shipping_profile_id)
    }
  }

  const existing: any[] = await marketplace.listVendorOrderSplits({ parent_order_id: order.id })
  const done = new Set(existing.map((row) => row.vendor_id))

  const createdChildIds: string[] = []

  for (const vendorId of sellerIds) {
    if (done.has(vendorId)) {
      continue
    }

    const sellerItems = items.filter((item) => sellerOf(item) === vendorId)
    const sellerMethods = ((order.shipping_methods ?? []) as any[]).filter(
      (method) => profileOwner.get(optionProfile.get(method.shipping_option_id) ?? "") === vendorId
    )

    const { result: child } = await createOrdersWorkflow(container).run({
      input: {
        currency_code: order.currency_code,
        region_id: order.region_id ?? undefined,
        // No customer_id on a seller order: Medusa lists a customer's orders by
        // it, so the buyer would see every seller order next to the one they paid
        // for. The buyer is kept in metadata.buyer_customer_id instead.
        sales_channel_id: order.sales_channel_id ?? undefined,
        email: order.email ?? undefined,
        locale: order.locale ?? undefined,
        status: "pending",
        no_notification: true,
        shipping_address: order.shipping_address ? stripAddress(order.shipping_address) : undefined,
        billing_address: order.billing_address ? stripAddress(order.billing_address) : undefined,
        items: sellerItems.map((item) => ({
          title: item.title,
          subtitle: item.subtitle ?? undefined,
          thumbnail: item.thumbnail ?? undefined,
          quantity: quantityOf(item),
          unit_price: toNumber(item.unit_price),
          is_tax_inclusive: item.is_tax_inclusive ?? false,
          is_discountable: item.is_discountable ?? true,
          requires_shipping: item.requires_shipping ?? true,
          product_id: item.product_id ?? undefined,
          product_title: item.product_title ?? undefined,
          product_description: item.product_description ?? undefined,
          product_subtitle: item.product_subtitle ?? undefined,
          product_type: item.product_type ?? undefined,
          product_collection: item.product_collection ?? undefined,
          product_handle: item.product_handle ?? undefined,
          variant_id: item.variant_id ?? undefined,
          variant_sku: item.variant_sku ?? undefined,
          variant_barcode: item.variant_barcode ?? undefined,
          variant_title: item.variant_title ?? undefined,
          variant_option_values: item.variant_option_values ?? undefined,
          // Records keyed on the parent's line item (rentals, tickets, ...) are
          // found on the child through this id.
          metadata: { ...(item.metadata ?? {}), parent_line_item_id: item.id },
          tax_lines: toTaxLines(item.tax_lines),
        })),
        shipping_methods: sellerMethods.map((method) => ({
          name: method.name,
          amount: toNumber(method.amount),
          is_tax_inclusive: method.is_tax_inclusive ?? false,
          shipping_option_id: method.shipping_option_id ?? undefined,
          data: method.data ?? undefined,
          tax_lines: toTaxLines(method.tax_lines),
        })),
        metadata: {
          split_child: true,
          parent_order_id: order.id,
          vendor_id: vendorId,
          buyer_customer_id: order.customer_id ?? null,
        },
      } as any,
    })

    await moveReservationsToChild(container, child.id)

    const {
      data: [totals],
    } = await query.graph({
      entity: "order",
      fields: ["id", "currency_code", "total", "item_total", "shipping_total", "tax_total"],
      filters: { id: child.id },
    })

    await link.create({
      [MARKETPLACE_MODULE]: { vendor_id: vendorId },
      [Modules.ORDER]: { order_id: child.id },
    })

    await marketplace.createVendorOrderSplits({
      parent_order_id: order.id,
      child_order_id: child.id,
      vendor_id: vendorId,
      currency_code: order.currency_code,
      items_total: round(toNumber(totals?.item_total ?? 0)),
      shipping_total: round(toNumber(totals?.shipping_total ?? 0)),
      tax_total: round(toNumber(totals?.tax_total ?? 0)),
      total: round(toNumber(totals?.total ?? 0)),
    })

    createdChildIds.push(child.id)
  }

  return { mode: "split", created_child_ids: createdChildIds }
}

// An address row copied to another order must not carry the original's ids.
const stripAddress = (address: any) => {
  const { id, created_at, updated_at, deleted_at, customer_id, ...rest } = address
  void id
  void created_at
  void updated_at
  void deleted_at
  void customer_id
  return rest
}

/**
 * Records such as rentals, tickets and expressions of interest are written when
 * the cart completes, so they point at the PARENT order and its line items. A
 * seller works on a CHILD order, whose line items are copies that remember the
 * original in metadata.parent_line_item_id. These helpers translate between the
 * two so those records are found from either side.
 */

/** The order itself plus, for a child order, its parent. */
export const getOrderFamilyIds = async (
  container: MedusaContainer,
  orderId: string
): Promise<string[]> => {
  const marketplace: any = container.resolve(MARKETPLACE_MODULE)
  const [split] = await marketplace.listVendorOrderSplits({ child_order_id: orderId })
  return split ? [orderId, split.parent_order_id] : [orderId]
}

/** True when this seller has a child order split from `parentOrderId`. */
export const vendorHasChildOf = async (
  container: MedusaContainer,
  vendorId: string,
  parentOrderId: string
): Promise<boolean> => {
  const marketplace: any = container.resolve(MARKETPLACE_MODULE)
  const rows = await marketplace.listVendorOrderSplits({
    parent_order_id: parentOrderId,
    vendor_id: vendorId,
  })
  return rows.length > 0
}

/** The line item ids a record may be keyed on: the given ids plus the parents' ids for copies. */
export const withParentLineItemIds = async (
  container: MedusaContainer,
  lineItemIds: string[]
): Promise<string[]> => {
  if (!lineItemIds.length) {
    return []
  }
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: lines } = await query.graph({
    entity: "order_line_item",
    fields: ["id", "metadata"],
    filters: { id: lineItemIds },
  })
  const parents = (lines ?? [])
    .map((line: any) => line?.metadata?.parent_line_item_id)
    .filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
  return [...new Set([...lineItemIds, ...parents])]
}

/**
 * Stock is reserved when the cart completes, against the PARENT order's line
 * items. A seller fulfils their CHILD order, whose line items are copies with new
 * ids, so Medusa would find no reservation to consume, the stock would never go
 * down, and the parent's reservation would hold stock forever. Move each
 * reservation onto the child's copy of the line (same stock location, same
 * quantity). Reservations of lines that stay on the parent are left alone.
 */
const moveReservationsToChild = async (container: MedusaContainer, childOrderId: string) => {
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const inventory: any = container.resolve(Modules.INVENTORY)

  const {
    data: [child],
  } = await query.graph({
    entity: "order",
    fields: ["id", "items.id", "items.metadata"],
    filters: { id: childOrderId },
  })

  for (const item of (child?.items ?? []) as any[]) {
    const parentLineId = item.metadata?.parent_line_item_id
    if (!parentLineId) {
      continue
    }
    const reservations: any[] = await inventory.listReservationItems({ line_item_id: parentLineId })
    if (!reservations.length) {
      continue
    }

    await inventory.createReservationItems(
      reservations.map((reservation) => ({
        line_item_id: item.id,
        inventory_item_id: reservation.inventory_item_id,
        location_id: reservation.location_id,
        quantity: reservation.quantity,
        allow_backorder: reservation.allow_backorder,
        description: reservation.description,
        metadata: reservation.metadata,
      }))
    )
    await inventory.deleteReservationItems(reservations.map((reservation) => reservation.id))
  }
}
