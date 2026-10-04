import { Suspense } from "react"

import Breadcrumbs from "@modules/common/components/breadcrumbs"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { ListingFilters } from "@lib/util/listing-filters"
import PaginatedProducts from "@modules/store/templates/paginated-products"
import { HttpTypes } from "@medusajs/types"

export default function CollectionTemplate({
  sortBy,
  collection,
  page,
  countryCode,
  filters,
}: {
  sortBy?: SortOptions
  collection: HttpTypes.StoreCollection
  page?: string
  countryCode: string
  filters?: ListingFilters
}) {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  return (
    <div className="content-container py-6">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "All products", href: "/store" },
          { label: collection.title },
        ]}
      />
      <h1 className="mb-4 font-display text-3xl font-extrabold tracking-tight">
        {collection.title}
      </h1>
      <RefinementList sortBy={sort} data-testid="sort-by-container" />
      <Suspense fallback={<SkeletonProductGrid />}>
        <PaginatedProducts
          filters={filters}
          sortBy={sort}
          page={pageNumber}
          collectionId={collection.id}
          countryCode={countryCode}
        />
      </Suspense>
    </div>
  )
}
