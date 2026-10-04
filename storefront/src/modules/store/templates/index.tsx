import { Suspense } from "react"

import Breadcrumbs from "@modules/common/components/breadcrumbs"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import CategorySidebar from "@modules/store/components/category-sidebar"
import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { ListingFilters } from "@lib/util/listing-filters"

import PaginatedProducts from "./paginated-products"

const StoreTemplate = ({
  sortBy,
  page,
  countryCode,
  filters,
}: {
  sortBy?: SortOptions
  page?: string
  countryCode: string
  filters?: ListingFilters
}) => {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  return (
    <div className="content-container py-6" data-testid="category-container">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "All products" }]}
      />
      <div className="grid items-start gap-6 small:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="hidden small:sticky small:top-40 small:block">
          <Suspense fallback={null}>
            <CategorySidebar />
          </Suspense>
        </aside>
        <section className="min-w-0">
          <h1
            className="mb-4 font-display text-3xl font-extrabold tracking-tight"
            data-testid="store-page-title"
          >
            All products
          </h1>
          <RefinementList sortBy={sort} data-testid="sort-by-container" />
          <Suspense fallback={<SkeletonProductGrid />}>
            <PaginatedProducts
              filters={filters}
              sortBy={sort}
              page={pageNumber}
              countryCode={countryCode}
            />
          </Suspense>
        </section>
      </div>
    </div>
  )
}

export default StoreTemplate
