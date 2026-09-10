"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { HttpTypes } from "@medusajs/types"
import { RentalAvailability } from "types/rental"
import { getAuthHeaders, revalidateCacheTag } from "./cookies"
import { getOrSetCart } from "./cart"

/**
 * Asks the backend whether a variant is free for a date range, and what the
 * period costs. Availability is deliberately not cached: a window that was
 * free a moment ago may have been taken by another shopper, and the backend
 * re-checks under a lock at add-to-cart and again at checkout.
 */
export async function getRentalAvailability({
  productId,
  variantId,
  startDate,
  endDate,
  currencyCode,
}: {
  productId: string
  variantId: string
  startDate: string
  endDate: string
  currencyCode?: string
}): Promise<RentalAvailability> {
  return sdk.client
    .fetch<RentalAvailability>(
      `/store/products/${productId}/rental-availability`,
      {
        method: "GET",
        query: {
          variant_id: variantId,
          start_date: startDate,
          end_date: endDate,
          ...(currencyCode ? { currency_code: currencyCode } : {}),
        },
        headers: { ...(await getAuthHeaders()) },
        cache: "no-store",
      }
    )
    .catch(medusaError)
}

/**
 * Rental line items go through their own route rather than the standard cart
 * endpoint: the backend validates the dates, re-checks availability under a
 * lock, and sets the unit price to the daily rate multiplied by the number of
 * rental days. Sending these through sdk.store.cart.createLineItem would skip
 * all of that and price the item as an outright sale.
 */
export async function addRentalToCart({
  variantId,
  countryCode,
  rentalStartDate,
  rentalEndDate,
  rentalDays,
}: {
  variantId: string
  countryCode: string
  rentalStartDate: string
  rentalEndDate: string
  rentalDays: number
}) {
  if (!variantId) {
    throw new Error("Missing variant ID when adding a rental to cart")
  }

  const cart = await getOrSetCart(countryCode)
  if (!cart) {
    throw new Error("Error retrieving or creating cart")
  }

  await sdk.client
    .fetch<{ cart: HttpTypes.StoreCart }>(
      `/store/carts/${cart.id}/line-items/rentals`,
      {
        method: "POST",
        body: {
          variant_id: variantId,
          // The backend rejects any rental line with a quantity other than 1:
          // one booking holds one unit for one date range.
          quantity: 1,
          metadata: {
            rental_start_date: rentalStartDate,
            rental_end_date: rentalEndDate,
            rental_days: rentalDays,
          },
        },
        headers: { ...(await getAuthHeaders()) },
      }
    )
    .then(async () => {
      await revalidateCacheTag("carts")
    })
    .catch(medusaError)
}
