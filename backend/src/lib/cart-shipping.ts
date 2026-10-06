import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Seller-aware view of a cart's shipping needs (Phase 2, step 3).
 *
 * Medusa keeps ONE shipping method per shipping profile, and does not filter
 * the option list by the profiles of the items in the cart. A seller therefore
 * ships under their own profile (their products and their shipping options
 * share it), and the cart is split into one group per profile: each group is
 * one seller's items plus the options that can ship them.
 *
 * Items on a shared platform profile form a group with no seller.
 */

export type CartShippingGroup = {
  shipping_profile_id: string
  vendor: { id: string; name: string | null } | null
  item_ids: string[]
}

type CartItem = {
  id: string
  variant?: { product?: { id?: string; shipping_profile?: { id?: string } | null } | null } | null
}

const loadCartItems = async (container: MedusaContainer, cartId: string): Promise<CartItem[]> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: ["id", "items.id", "items.variant.product.id", "items.variant.product.shipping_profile.id"],
    filters: { id: cartId },
  })
  return ((data?.[0] as any)?.items ?? []) as CartItem[]
}

/** product id -> the seller that owns it (products with no seller are absent). */
export const loadProductSellers = async (
  container: MedusaContainer,
  productIds: string[]
): Promise<Map<string, { id: string; name: string | null }>> => {
  const sellers = new Map<string, { id: string; name: string | null }>()
  if (!productIds.length) {
    return sellers
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  // take: null returns every seller. The default is the first 15 rows, so dishes of a
  // later seller were treated as "no seller" and their orders reached nobody.
  const { data: vendors } = await query.graph({
    entity: "vendor",
    fields: ["id", "name", "products.id"],
    pagination: { take: null },
  })

  const wanted = new Set(productIds)
  for (const vendor of (vendors ?? []) as any[]) {
    for (const product of vendor.products ?? []) {
      if (wanted.has(product.id)) {
        sellers.set(product.id, { id: vendor.id, name: vendor.name ?? null })
      }
    }
  }
  return sellers
}

export const getCartShippingGroups = async (
  container: MedusaContainer,
  cartId: string
): Promise<CartShippingGroup[]> => {
  const items = await loadCartItems(container, cartId)
  const productIds = items.map((item) => item.variant?.product?.id).filter((id): id is string => !!id)
  const sellers = await loadProductSellers(container, productIds)

  const groups = new Map<string, CartShippingGroup>()
  for (const item of items) {
    const profileId = item.variant?.product?.shipping_profile?.id
    if (!profileId) {
      continue
    }
    const productId = item.variant?.product?.id
    const group =
      groups.get(profileId) ??
      ({
        shipping_profile_id: profileId,
        vendor: (productId && sellers.get(productId)) || null,
        item_ids: [],
      } as CartShippingGroup)
    group.item_ids.push(item.id)
    groups.set(profileId, group)
  }

  return [...groups.values()]
}

/** The shipping profiles of the items in the cart (one per seller, plus shared ones). */
export const getCartShippingProfileIds = async (
  container: MedusaContainer,
  cartId: string
): Promise<string[]> => {
  const items = await loadCartItems(container, cartId)
  return [
    ...new Set(
      items
        .map((item) => item.variant?.product?.shipping_profile?.id)
        .filter((id): id is string => !!id)
    ),
  ]
}
