"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { HttpTypes } from "@medusajs/types"
import { cache } from "react"
import { getAuthHeaders, getCacheDirectives } from "./cookies"

// See the note in regions.ts for why these are client.fetch calls rather than
// the sdk.store.* helpers. As in customer.ts, the old calls mixed the cache tag
// in with the authorization header, so only the auth half ever took effect.
export const retrieveOrder = cache(async function (id: string) {
  const headers = await getAuthHeaders()
  return sdk.client
    .fetch<HttpTypes.StoreOrderResponse>(`/store/orders/${id}`, {
      method: "GET",
      query: { fields: "*payment_collections.payments" },
      headers,
      ...(await getCacheDirectives("orders")),
    })
    .then(({ order }) => order)
    .catch((err) => {
      if (err?.status === 401 || err?.status === 404) {
        return null
      }
      return medusaError(err)
    })
})

export const listOrders = cache(async function (
  limit: number = 10,
  offset: number = 0
) {
  const headers = await getAuthHeaders()
  if (!(headers as any)?.authorization) {
    return null
  }

  return sdk.client
    .fetch<HttpTypes.StoreOrderListResponse>("/store/orders", {
      method: "GET",
      query: { limit, offset },
      headers,
      ...(await getCacheDirectives("orders")),
    })
    .then(({ orders }) => orders)
    .catch((err) => {
      // A 401 or 404 here means the auth cookie was not available in this render
      // pass (e.g. immediately after login before the cookie is committed,
      // or a stale cached render). Return null so the dashboard still
      // renders rather than crashing the page.
      if (err && (err.status === 401 || err.status === 404)) {
        return null
      }
      return medusaError(err)
    })
})

export type SellerOrder = {
  id: string
  display_id: number | null
  seller: { id: string; name: string | null }
  status: string | null
  fulfillment_status: "not_fulfilled" | "fulfilled" | "shipped" | "delivered"
  currency_code: string
  total: number
  items: { title: string; thumbnail: string | null; quantity: number }[]
}

// Who ships what when one order holds several sellers' items. Empty when the
// order has a single seller: the order itself is theirs.
export const retrieveSellerOrders = cache(async function (id: string) {
  return sdk.client
    .fetch<{ seller_orders: SellerOrder[] }>(`/store/orders/${id}/seller-orders`, {
      method: "GET",
      headers: await getAuthHeaders(),
      ...(await getCacheDirectives("orders")),
    })
    .then(({ seller_orders }) => seller_orders)
    .catch(() => [] as SellerOrder[])
})
