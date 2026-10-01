import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { MARKETPLACE_MODULE } from "../../../modules/marketplace"
import { assertVendorOwns, getOwnedIds } from "../shared/vendor-scope"
import { getOwnedShippingOptionIds } from "../shared/shipping-option-scope"

/**
 * Guards for what a seller may DO to an order (Phase 4): fulfil, ship, deliver,
 * cancel, refund, return. Every action runs on the seller's own order only:
 * their child order, or an order that is wholly theirs. Reading is in ./route.ts.
 *
 * Rules, all answered with 404 (not yours / does not exist) or 400/409 (yours but
 * not allowed), never by trusting an id in the body:
 *  - the order is linked to the seller
 *  - every line item named belongs to that order
 *  - a fulfilment named belongs to that order
 *  - a shipping option named is the seller's own AND one of the order's methods
 *  - a location named is the seller's own
 *  - an older shared order (items of other sellers too) allows only fulfilment of
 *    the seller's own items; cancel, refund and return would reach other sellers'
 *    items and money, so they are refused
 */

export const assertVendorOwnsOrder = (
  req: AuthenticatedMedusaRequest,
  orderId: string
): Promise<void> => assertVendorOwns(req, "orders", orderId, "Order not found.")

export type SellerOrderContext = {
  id: string
  status: string
  currency_code: string
  isChild: boolean
  isMixed: boolean
  parentOrderId: string | null
  /** Every line item on the order. */
  itemIds: Set<string>
  /** The seller's own line items (all of them, except on an older shared order). */
  ownItemIds: Set<string>
  shippingOptionIds: Set<string>
  fulfillmentIds: Set<string>
  items: Array<{ id: string; quantity: number; fulfilled_quantity: number }>
}

const toNumber = (value: any): number => {
  if (value === null || value === undefined) return 0
  if (typeof value === "number") return value
  if (typeof value === "object") return toNumber(value.numeric_ ?? value.value ?? value.raw_?.value)
  const parsed = Number(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

/** Loads the order for an action; the caller has already run assertVendorOwnsOrder. */
export const loadSellerOrder = async (
  req: AuthenticatedMedusaRequest,
  orderId: string
): Promise<SellerOrderContext> => {
  const query: any = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.products.id"],
    filters: { id: [req.auth_context.actor_id] },
  })
  const ownProducts = new Set<string>(
    ((vendorAdmin?.vendor?.products ?? []) as any[]).map((p) => p?.id).filter(Boolean)
  )

  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "status",
      "currency_code",
      "metadata",
      "items.id",
      "items.product_id",
      "items.detail.quantity",
      "items.detail.fulfilled_quantity",
      "shipping_methods.shipping_option_id",
      "fulfillments.id",
    ],
    filters: { id: orderId },
  })

  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found.")
  }

  const items = (order.items ?? []) as any[]
  // An item with no product (a deposit, a custom line) is the order owner's own.
  const isMixed = items.some((item) => item.product_id && !ownProducts.has(item.product_id))

  return {
    id: order.id,
    status: order.status,
    currency_code: order.currency_code,
    isChild: !!order.metadata?.split_child,
    isMixed,
    parentOrderId: order.metadata?.parent_order_id ?? null,
    itemIds: new Set(items.map((item) => item.id)),
    ownItemIds: new Set(
      items.filter((item) => !item.product_id || ownProducts.has(item.product_id)).map((item) => item.id)
    ),
    shippingOptionIds: new Set(
      ((order.shipping_methods ?? []) as any[]).map((m) => m.shipping_option_id).filter(Boolean)
    ),
    fulfillmentIds: new Set(((order.fulfillments ?? []) as any[]).map((f) => f.id)),
    items: items.map((item) => ({
      id: item.id,
      quantity: toNumber(item.detail?.quantity),
      fulfilled_quantity: toNumber(item.detail?.fulfilled_quantity),
    })),
  }
}

/** Cancel, refund and return would reach other sellers' items and money on an older shared order. */
export const assertOrderNotShared = (order: SellerOrderContext): void => {
  if (order.isMixed) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "This is an older order that also holds other sellers' items. Contact the platform to cancel, refund or return it."
    )
  }
}

export const assertItemsBelongToOrder = (order: SellerOrderContext, itemIds: string[]): void => {
  for (const id of itemIds) {
    // Only the seller's own items: on an older shared order the others are not theirs to touch.
    if (!order.ownItemIds.has(id)) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order item not found.")
    }
  }
}

export const assertFulfillmentBelongsToOrder = (order: SellerOrderContext, fulfillmentId: string): void => {
  if (!order.fulfillmentIds.has(fulfillmentId)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Fulfillment not found.")
  }
}

/** The option must be the seller's own and one of the methods the buyer chose on this order. */
export const assertShippingOptionForOrder = async (
  req: AuthenticatedMedusaRequest,
  order: SellerOrderContext,
  optionId: string
): Promise<void> => {
  const owned = await getOwnedShippingOptionIds(req)
  if (!owned.includes(optionId) || !order.shippingOptionIds.has(optionId)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Shipping option not found.")
  }
}

export const assertLocationIsOwn = async (
  req: AuthenticatedMedusaRequest,
  locationId: string
): Promise<void> => {
  const owned = await getOwnedIds(req, "stock_locations")
  if (!owned.includes(locationId)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Stock location not found.")
  }
}

/** The ledger row of a child order, or null for an order that is wholly the seller's. */
export const getLedgerEntry = async (req: AuthenticatedMedusaRequest, childOrderId: string) => {
  const marketplace: any = req.scope.resolve(MARKETPLACE_MODULE)
  const [entry] = await marketplace.listVendorOrderSplits({ child_order_id: childOrderId })
  return entry ?? null
}

/** Body validation with a 400, not a 500, on bad input. */
export const parseBody = <T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> => {
  const result = schema.safeParse(body ?? {})
  if (!result.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      result.error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ")
    )
  }
  return result.data
}
