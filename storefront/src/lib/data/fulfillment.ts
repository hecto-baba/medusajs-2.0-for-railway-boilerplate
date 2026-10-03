import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { cache } from "react"
import { getCacheDirectives } from "./cookies"

// See the note in regions.ts for why this is a client.fetch call rather than
// the sdk.store.* helper.
export const listCartShippingMethods = cache(async function (cartId: string) {
  return sdk.client
    .fetch<HttpTypes.StoreShippingOptionListResponse>(
      "/store/shipping-options",
      {
        method: "GET",
        query: { cart_id: cartId },
        ...(await getCacheDirectives("shipping")),
      }
    )
    .then(({ shipping_options }) => shipping_options)
    .catch(() => {
      return null
    })
})

export type CartShippingGroup = {
  shipping_profile_id: string
  vendor: { id: string; name: string | null } | null
  item_ids: string[]
  shipping_options: HttpTypes.StoreCartShippingOption[]
}

// One group per seller (items sharing a shipping profile) with only the options
// that ship those items. Medusa's own list is flat and keeps one method per
// profile, so a buyer would otherwise see every seller's options mixed together.
export const listCartShippingGroups = cache(async function (cartId: string) {
  return sdk.client
    .fetch<{ shipping_groups: CartShippingGroup[] }>(
      `/store/carts/${cartId}/seller-shipping-options`,
      {
        method: "GET",
        ...(await getCacheDirectives("shipping")),
      }
    )
    .then(({ shipping_groups }) => shipping_groups)
    .catch(() => {
      return null
    })
})
