import { Suspense } from "react"

import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import PaginatedProducts from "@modules/store/templates/paginated-products"

const DigitalProductsTemplate = ({
  sortBy,
  page,
  countryCode,
}: {
  sortBy?: SortOptions
  page?: string
  countryCode: string
}) => {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  return (
    <div
      className="content-container flex flex-col py-8 small:flex-row small:items-start"
      data-testid="digital-products-container"
    >
      <RefinementList sortBy={sort} data-testid="sort-by-container" />
      <div className="w-full">
        <div className="mb-6">
          <h1
            className="mb-1 font-display text-3xl font-extrabold tracking-tight text-ink small:text-4xl"
            data-testid="digital-products-title"
          >
            Digital Products
          </h1>
          <p className="text-sm text-muted">
            Browse our collection of downloadable e-books, automation guides, workflows &amp; digital assets.
          </p>
        </div>
        <Suspense fallback={<SkeletonProductGrid />}>
          <PaginatedProducts
            sortBy={sort}
            page={pageNumber}
            countryCode={countryCode}
            digitalFilter="only"
          />
        </Suspense>
      </div>
    </div>
  )
}

export default DigitalProductsTemplate
