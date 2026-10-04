import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { getOwnedIds, getVendorId } from "./vendor-scope"

/**
 * Ownership checks for the seller routes that act on a single quote or delivery.
 *
 * Both used to trust any logged-in seller: a seller who knew (or guessed) an id
 * could read, change or accept another seller's quote, or read and change
 * another seller's delivery. Every handler on those routes now calls one of
 * these first. A row that is not the caller's answers "not found", the same as a
 * row that does not exist, so ids cannot be probed.
 */

// ---- quotes

export type QuoteOwnershipInput = {
  metadata?: Record<string, any> | null
  cart?: { items?: Array<{ product_id?: string | null }> | null } | null
}

/**
 * A quote belongs to a seller when the quote names them, or any item in it is
 * one of their products.
 */
export const quoteBelongsToVendor = (
  quote: QuoteOwnershipInput,
  vendorId: string,
  ownedProductIds: Iterable<string>
): boolean => {
  if (quote.metadata?.vendor_id && quote.metadata.vendor_id === vendorId) {
    return true
  }
  const owned = new Set(ownedProductIds)
  return (quote.cart?.items ?? []).some((item) => !!item?.product_id && owned.has(item.product_id))
}

/** A seller may only send a price or decline: never accept, which is the buyer's decision. */
export const VENDOR_QUOTE_STATUSES = ["pending_customer", "merchant_rejected"] as const
const VENDOR_CAN_CHANGE_FROM = ["pending_merchant", "pending_customer"]

export const assertVendorMaySetQuoteStatus = (currentStatus: string, nextStatus: unknown): void => {
  if (typeof nextStatus !== "string" || !(VENDOR_QUOTE_STATUSES as readonly string[]).includes(nextStatus)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `A seller can only set a quote to ${VENDOR_QUOTE_STATUSES.join(" or ")}.`
    )
  }
  if (!VENDOR_CAN_CHANGE_FROM.includes(currentStatus)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "This quote has already been decided and can no longer be changed."
    )
  }
}

// These record payment and fulfilment, which only the platform sets, and who the
// quote belongs to. A seller must not be able to write them through free-form metadata.
const PLATFORM_ONLY_QUOTE_KEYS = ["payment_status", "fulfillment_status", "vendor_id", "messages"]

export const stripPlatformQuoteKeys = (metadata: unknown): Record<string, any> => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {}
  }
  return Object.fromEntries(
    Object.entries(metadata as Record<string, any>).filter(([key]) => !PLATFORM_ONLY_QUOTE_KEYS.includes(key))
  )
}

/** Resolves the quote and confirms it is the calling seller's. Returns the quote's id, status and metadata. */
export const assertVendorOwnsQuote = async (
  req: AuthenticatedMedusaRequest,
  quoteId: string
): Promise<{ id: string; status: string; metadata: Record<string, any> | null }> => {
  const query: any = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [quote],
  } = await query.graph({
    entity: "quote",
    fields: ["id", "status", "metadata", "cart.items.product_id"],
    filters: { id: quoteId },
  })

  const vendorId = await getVendorId(req)
  const ownedProducts = await getOwnedIds(req, "products")

  if (!quote || !quoteBelongsToVendor(quote, vendorId, ownedProducts)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Quote not found")
  }
  return { id: quote.id, status: quote.status, metadata: quote.metadata ?? null }
}

// ---- deliveries

/** Restaurants the calling seller runs: the ones linked to their vendor, or that list them as an admin. */
export const getVendorRestaurantIds = async (req: AuthenticatedMedusaRequest): Promise<string[]> => {
  const query: any = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const ids = new Set<string>(await getOwnedIds(req, "restaurants"))

  const {
    data: [admin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["id", "email"],
    filters: { id: [req.auth_context.actor_id] },
  })
  if (admin?.email) {
    try {
      const { data: restaurants } = await query.graph({
        entity: "restaurant",
        fields: ["id"],
        filters: { admins: { email: admin.email } },
      })
      for (const restaurant of restaurants ?? []) {
        if (restaurant?.id) ids.add(restaurant.id)
      }
    } catch {
      // The vendor link above is enough on its own.
    }
  }
  return [...ids]
}

/** Confirms the delivery is for one of the calling seller's restaurants. */
export const assertVendorOwnsDelivery = async (
  req: AuthenticatedMedusaRequest,
  deliveryId: string
): Promise<void> => {
  const query: any = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [delivery],
  } = await query.graph({
    entity: "delivery",
    fields: ["id", "restaurant.id"],
    filters: { id: deliveryId },
  })

  const restaurantIds = await getVendorRestaurantIds(req)
  if (!delivery?.restaurant?.id || !restaurantIds.includes(delivery.restaurant.id)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Delivery not found")
  }
}
