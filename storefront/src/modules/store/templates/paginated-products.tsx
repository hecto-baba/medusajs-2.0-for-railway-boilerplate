import { getProductsListWithSort } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import ProductPreview from "@modules/products/components/product-preview"
import { Pagination } from "@modules/store/components/pagination"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { ListingFilters, hasListingFilters } from "@lib/util/listing-filters"

const PRODUCT_LIMIT = 12

type PaginatedProductsParams = {
  limit: number
  collection_id?: string[]
  category_id?: string[]
  id?: string[]
  order?: string
}

export default async function PaginatedProducts({
  sortBy,
  page,
  collectionId,
  categoryId,
  productsIds,
  countryCode,
  digitalFilter = "exclude",
  filters,
}: {
  sortBy?: SortOptions
  page: number
  collectionId?: string
  categoryId?: string
  productsIds?: string[]
  countryCode: string
  digitalFilter?: "only" | "exclude"
  filters?: ListingFilters
}) {
  const queryParams: PaginatedProductsParams = {
    limit: 12,
  }

  if (collectionId) {
    queryParams["collection_id"] = [collectionId]
  }

  if (categoryId) {
    queryParams["category_id"] = [categoryId]
  }

  if (productsIds) {
    queryParams["id"] = productsIds
  }

  const region = await getRegion(countryCode)

  if (!region) {
    return null
  }

  let {
    response: { products, count },
  } = await getProductsListWithSort({
    page,
    queryParams,
    sortBy,
    countryCode,
    digitalFilter,
    filters,
  })

  const totalPages = Math.ceil(count / PRODUCT_LIMIT)

  if (!products.length) {
    return (
      <div
        className="rounded-large bg-card px-6 py-16 text-center shadow-lift"
        data-testid="products-empty"
      >
        <p className="font-display text-xl font-extrabold">
          {hasListingFilters(filters) ? "No products match these filters" : "No products here yet"}
        </p>
        <p className="mt-1 text-sm text-muted">
          {hasListingFilters(filters) ? "Try widening the price range or clearing the filters." : "Check back soon."}
        </p>
      </div>
    )
  }

  return (
    <>
      <p className="mb-4 text-sm text-muted" data-testid="products-count">
        {count} {count === 1 ? "product" : "products"}
      </p>
      <ul
        className="grid w-full grid-cols-2 gap-3 xsmall:grid-cols-3 small:gap-4 medium:grid-cols-4 large:grid-cols-5"
        data-testid="products-list"
      >
        {products.map((p) => {
          return (
            <li key={p.id}>
              <ProductPreview product={p} region={region} />
            </li>
          )
        })}
      </ul>
      {totalPages > 1 && (
        <Pagination
          data-testid="product-pagination"
          page={page}
          totalPages={totalPages}
        />
      )}
    </>
  )
}
