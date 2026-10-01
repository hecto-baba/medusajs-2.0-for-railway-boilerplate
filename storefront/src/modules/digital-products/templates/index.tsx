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
      className="flex flex-col small:flex-row small:items-start py-6 content-container"
      data-testid="digital-products-container"
    >
      <RefinementList sortBy={sort} data-testid="sort-by-container" />
      <div className="w-full">
        <div className="mb-8">
          <h1 className="text-2xl-semi text-ui-fg-base mb-2" data-testid="digital-products-title">
            Digital Products
          </h1>
          <p className="text-ui-fg-subtle text-base-regular">
            Browse our collection of downloadable e-books, automation guides, workflows & digital assets.
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
