import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { MARKETPLACE_MODULE } from "../modules/marketplace"

/**
 * Makes sure a restaurant's dishes belong to the seller who runs that restaurant.
 *
 * A seller's Orders list is built from the seller's products. Dishes added by the
 * platform admin were linked to the restaurant only, so an order for them was
 * linked to no seller and never showed up in the seller's Orders. This links each
 * such dish to the seller of its restaurant. Dishes that already have a seller, and
 * products that are not dishes, are left alone. Safe to run again.
 */
export const linkRestaurantDishesToSellers = async (
  container: MedusaContainer,
  productIds: string[]
): Promise<void> => {
  if (!productIds.length) {
    return
  }
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const link: any = container.resolve(ContainerRegistrationKeys.LINK)

  // The restaurant-to-dish link is the source of truth: dishes added by an admin carry
  // no restaurant in their own metadata.
  const wanted = new Set(productIds)
  const { data: restaurants } = await query.graph({
    entity: "restaurant",
    fields: ["id", "products.id"],
    pagination: { take: null },
  })
  const dishRestaurant = new Map<string, string>()
  for (const restaurant of restaurants ?? []) {
    for (const product of restaurant.products ?? []) {
      if (product?.id && wanted.has(product.id) && !dishRestaurant.has(product.id)) {
        dishRestaurant.set(product.id, restaurant.id)
      }
    }
  }
  if (!dishRestaurant.size) {
    return
  }

  const { data: vendors } = await query.graph({
    entity: "vendor",
    fields: ["id", "products.id", "restaurants.id"],
    pagination: { take: null },
  })

  const owned = new Set<string>()
  const restaurantSeller = new Map<string, string>()
  for (const vendor of vendors ?? []) {
    for (const product of vendor.products ?? []) {
      if (product?.id) owned.add(product.id)
    }
    for (const restaurant of vendor.restaurants ?? []) {
      if (restaurant?.id && !restaurantSeller.has(restaurant.id)) {
        restaurantSeller.set(restaurant.id, vendor.id)
      }
    }
  }

  for (const [productId, restaurantId] of dishRestaurant) {
    const vendorId = restaurantSeller.get(restaurantId)
    if (owned.has(productId) || !vendorId) {
      continue
    }
    await link.create({
      [MARKETPLACE_MODULE]: { vendor_id: vendorId },
      [Modules.PRODUCT]: { product_id: productId },
    })
  }
}
