"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { HttpTypes } from "@medusajs/types"

import { getOrSetCart } from "./cart"
import { getAuthHeaders, revalidateCacheTag } from "./cookies"

/**
 * Adds a variant to the cart as an Expression of Interest: the cart line is
 * charged the configured deposit instead of the full price, and the balance is
 * tracked on the order. The server decides the amount from the variant's
 * configuration, so the client sends only which variant it wants.
 *
 * Completion needs no special call: placeOrder() sends every cart through
 * /complete-all, which records EOI lines along with everything else.
 */
export async function addEoiToCart({
  variantId,
  countryCode,
}: {
  variantId: string
  countryCode: string
}) {
  if (!variantId) {
    throw new Error("Missing variant ID when adding an expression of interest")
  }

  const cart = await getOrSetCart(countryCode)
  if (!cart) {
    throw new Error("Error retrieving or creating cart")
  }

  await sdk.client
    .fetch<{ cart: HttpTypes.StoreCart }>(
      `/store/carts/${cart.id}/line-items/eoi`,
      {
        method: "POST",
        // The backend rejects any EOI line with a quantity other than 1.
        body: { variant_id: variantId, quantity: 1 },
        headers: { ...(await getAuthHeaders()) },
      }
    )
    .then(async () => {
      await revalidateCacheTag("carts")
    })
    .catch(medusaError)
}
