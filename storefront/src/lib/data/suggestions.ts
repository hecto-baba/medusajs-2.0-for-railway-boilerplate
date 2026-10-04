"use server"

import { getProductPrice } from "@lib/util/get-product-price"
import { getProductKind } from "@lib/util/product-kind"

import { getAppointmentProductIds } from "./product-kind"
import { getProductsList } from "./products"
import { getRegion } from "./regions"

export type CartSuggestion = {
  productId: string
  variantId: string
  title: string
  handle: string
  thumbnail: string | null
  unitLabel: string | null
  amount: number
  originalAmount: number | null
  currencyCode: string
  /** Stock limit when the variant tracks inventory. */
  max?: number
}

/**
 * "Complete your cart": a few products that can be added in one tap. Only
 * plain products qualify (one option, priced, in stock): anything that needs a
 * choice, dates, a seat or an enquiry would be wrong to add blindly. A failed
 * lookup returns nothing so the drawer simply shows no suggestions.
 */
export async function getCartSuggestions({
  countryCode,
  excludeProductIds,
  limit = 6,
}: {
  countryCode: string
  excludeProductIds: string[]
  limit?: number
}): Promise<CartSuggestion[]> {
  try {
    const region = await getRegion(countryCode)
    const [{ response }, appointmentIds] = await Promise.all([
      getProductsList({ queryParams: { limit: 40 }, countryCode }),
      getAppointmentProductIds(countryCode, region?.currency_code),
    ])
    const excluded = new Set(excludeProductIds)
    const suggestions: CartSuggestion[] = []

    for (const product of response.products) {
      if (suggestions.length >= limit) break
      if (excluded.has(product.id)) continue
      if (getProductKind(product, appointmentIds) !== "plain") continue

      const variant = product.variants?.[0]
      const { cheapestPrice } = getProductPrice({ product })
      if (!variant || !cheapestPrice) continue

      const tracked =
        !!variant.manage_inventory &&
        !variant.allow_backorder &&
        typeof variant.inventory_quantity === "number"
      if (tracked && (variant.inventory_quantity ?? 0) <= 0) continue

      suggestions.push({
        productId: product.id,
        variantId: variant.id,
        title: product.title,
        handle: product.handle,
        thumbnail: product.thumbnail ?? product.images?.[0]?.url ?? null,
        unitLabel:
          variant.title && !/^default( variant)?$/i.test(variant.title)
            ? variant.title
            : null,
        amount: cheapestPrice.calculated_price_number,
        originalAmount:
          cheapestPrice.original_price_number >
          cheapestPrice.calculated_price_number
            ? cheapestPrice.original_price_number
            : null,
        currencyCode: cheapestPrice.currency_code,
        max: tracked ? (variant.inventory_quantity as number) : undefined,
      })
    }

    return suggestions
  } catch {
    return []
  }
}
