import "server-only"

import { sdk } from "@lib/config"
import { getVendorAuthHeaders } from "./cookies"
import type { ListResponse, VendorProduct } from "./vendor-client"

/** Page size the products table opens with; the first page is fetched to match. */
export const PRODUCTS_FIRST_PAGE_SIZE = 20

export type VendorProductsPage = ListResponse<{ products: VendorProduct[] }>

/**
 * The first page of the vendor's products, read on the server so the table can
 * render with data instead of mounting empty and fetching through the proxy.
 *
 * Returns null on any failure (expired session, backend down). The table then
 * falls back to its normal client-side fetch, where a 401 redirects to /login
 * and other errors surface the way they always have, so a failure here never
 * changes behaviour - it only forgoes the head start.
 *
 * Kept out of vendor.ts on purpose: that file is "use server", which would make
 * every export a client-callable action.
 */
export const getInitialVendorProducts =
  async (): Promise<VendorProductsPage | null> => {
    try {
      return await sdk.client.fetch<VendorProductsPage>("/vendors/products", {
        method: "GET",
        query: { limit: PRODUCTS_FIRST_PAGE_SIZE, offset: 0 },
        headers: { ...(await getVendorAuthHeaders()) },
        cache: "no-store",
      })
    } catch {
      return null
    }
  }
