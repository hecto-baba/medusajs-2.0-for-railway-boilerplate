import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { cache } from "react"
import { getRegion } from "./regions"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { sortProducts } from "@lib/util/sort-products"
import { ListingFilters } from "@lib/util/listing-filters"
import { getProductPrice } from "@lib/util/get-product-price"
import { getAuthHeaders, getSharedCacheDirectives } from "./cookies"

// See the note in regions.ts for why these are client.fetch calls rather than
// the sdk.store.* helpers.
export const getProductsById = cache(async function ({
  ids,
  regionId,
}: {
  ids: string[]
  regionId: string
}) {
  return sdk.client
    .fetch<HttpTypes.StoreProductListResponse>("/store/products", {
      method: "GET",
      query: {
        id: ids,
        region_id: regionId,
        fields: "*variants.calculated_price,+variants.inventory_quantity,+rental_configuration.*,+variants.digital_product.id,+enquiry_configuration.*,+variants.eoi_configuration.*",
      },
      ...getSharedCacheDirectives("products", 60),
    })
    .then(({ products }) => products)
})

export const getProductByHandle = cache(async function (
  handle: string,
  regionId: string
) {
  return sdk.client
    .fetch<HttpTypes.StoreProductListResponse>("/store/products", {
      method: "GET",
      query: {
        handle,
        region_id: regionId,
        // Same field set as getProductsById so the page does not need a second
        // /store/products?id= round trip just to learn enquiry/EOI config.
        fields: "*variants.calculated_price,+variants.inventory_quantity,+rental_configuration.*,+variants.digital_product.id,+enquiry_configuration.*,+variants.eoi_configuration.*",
      },
      ...getSharedCacheDirectives("products", 60),
    })
    .then(({ products }) => products[0])
})

export const getProductsList = cache(async function ({
  pageParam = 1,
  queryParams,
  countryCode,
}: {
  pageParam?: number
  queryParams?: HttpTypes.StoreProductListParams
  countryCode: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.StoreProductListParams
}> {
  const limit = queryParams?.limit || 12
  const validPageParam = Math.max(pageParam, 1);
  const offset = (validPageParam - 1) * limit
  const region = await getRegion(countryCode)

  if (!region) {
    return {
      response: { products: [], count: 0 },
      nextPage: null,
    }
  }
  return sdk.client
    .fetch<HttpTypes.StoreProductListResponse>("/store/products", {
      method: "GET",
      query: {
        limit,
        offset,
        region_id: region.id,
        fields: "*variants.calculated_price,+variants.inventory_quantity,+variants.digital_product.id,+rental_configuration.*,+enquiry_configuration.*",
        ...queryParams,
      },
      ...getSharedCacheDirectives("products", 60),
    })
    .then(({ products, count }) => {
      const nextPage = count > offset + limit ? pageParam + 1 : null

      return {
        response: {
          products,
          count,
        },
        nextPage: nextPage,
        queryParams,
      }
    })
})

/**
 * This will fetch 100 products to the Next.js cache and sort them based on the sortBy parameter.
 * It will then return the paginated products based on the page and limit parameters.
 */
export const getProductsListWithSort = cache(async function ({
  page = 0,
  queryParams,
  sortBy = "created_at",
  countryCode,
  digitalFilter,
  filters,
}: {
  page?: number
  queryParams?: HttpTypes.StoreProductListParams
  sortBy?: SortOptions
  countryCode: string
  digitalFilter?: "only" | "exclude"
  filters?: ListingFilters
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.StoreProductListParams
}> {
  const limit = queryParams?.limit || 12

  const {
    response: { products, count },
  } = await getProductsList({
    pageParam: 0,
    queryParams: {
      ...queryParams,
      limit: 100,
    },
    countryCode,
  })

  let filteredProducts = products
  if (digitalFilter === "only") {
    filteredProducts = products.filter((p: any) =>
      p.variants?.some((v: any) => !!v.digital_product)
    )
  } else if (digitalFilter === "exclude") {
    filteredProducts = products.filter(
      (p: any) => !p.variants?.some((v: any) => !!v.digital_product)
    )
  }

  // Price filters work on the cheapest variant. Done here, on the 100 products
  // already loaded for sorting, because the list endpoint cannot filter by price.
  if (filters?.onSale || filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
    filteredProducts = filteredProducts.filter((product) => {
      const price = getProductPrice({ product }).cheapestPrice
      if (!price) return false
      if (filters.onSale && !(price.original_price_number > price.calculated_price_number)) return false
      if (filters.minPrice !== undefined && price.calculated_price_number < filters.minPrice) return false
      if (filters.maxPrice !== undefined && price.calculated_price_number > filters.maxPrice) return false
      return true
    })
  }

  const sortedProducts = sortProducts(filteredProducts, sortBy)

  const pageParam = (page - 1) * limit
  const filteredCount = filteredProducts.length

  const nextPage = filteredCount > pageParam + limit ? pageParam + limit : null

  const paginatedProducts = sortedProducts.slice(pageParam, pageParam + limit)

  return {
    response: {
      products: paginatedProducts,
      count: filteredCount,
    },
    nextPage,
    queryParams,
  }
})

