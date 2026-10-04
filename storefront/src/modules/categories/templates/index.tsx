import { notFound } from "next/navigation"
import { Suspense } from "react"

import Breadcrumbs from "@modules/common/components/breadcrumbs"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import CategorySidebar from "@modules/store/components/category-sidebar"
import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { ListingFilters } from "@lib/util/listing-filters"
import PaginatedProducts from "@modules/store/templates/paginated-products"
import { HttpTypes } from "@medusajs/types"

export default function CategoryTemplate({
  categories,
  sortBy,
  page,
  countryCode,
  filters,
}: {
  categories: HttpTypes.StoreProductCategory[]
  sortBy?: SortOptions
  page?: string
  countryCode: string
  filters?: ListingFilters
}) {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  const category = categories[categories.length - 1]
  const parents = categories.slice(0, categories.length - 1)

  if (!category || !countryCode) notFound()

  return (
    <div className="content-container py-6" data-testid="category-container">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "All products", href: "/store" },
          ...parents.map((p) => ({
            label: p.name,
            href: `/categories/${p.handle}`,
          })),
          { label: category.name },
        ]}
      />
      <div className="grid items-start gap-6 small:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="hidden small:sticky small:top-40 small:block">
          <Suspense fallback={null}>
            <CategorySidebar currentHandle={category.handle} />
          </Suspense>
        </aside>
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {parents.map((parent) => (
              <span key={parent.id} className="text-muted">
                <LocalizedClientLink
                  className="mr-3 hover:text-ink"
                  href={`/categories/${parent.handle}`}
                  data-testid="sort-by-link"
                >
                  {parent.name}
                </LocalizedClientLink>
                /
              </span>
            ))}
            <h1
              className="font-display text-3xl font-extrabold tracking-tight"
              data-testid="category-page-title"
            >
              {category.name}
            </h1>
          </div>
          {category.description && (
            <p className="mb-4 max-w-prose text-sm text-muted">
              {category.description}
            </p>
          )}
          {category.category_children && category.category_children.length > 0 && (
            <ul className="mb-5 flex flex-wrap gap-2">
              {category.category_children.map((c) => (
                <li key={c.id}>
                  <LocalizedClientLink
                    href={`/categories/${c.handle}`}
                    className="inline-flex rounded-circle border border-line bg-card px-3.5 py-1.5 text-sm font-semibold hover:border-muted"
                  >
                    {c.name}
                  </LocalizedClientLink>
                </li>
              ))}
            </ul>
          )}
          <RefinementList sortBy={sort} data-testid="sort-by-container" />
          <Suspense fallback={<SkeletonProductGrid />}>
            <PaginatedProducts
              filters={filters}
              sortBy={sort}
              page={pageNumber}
              categoryId={category.id}
              countryCode={countryCode}
            />
          </Suspense>
        </section>
      </div>
    </div>
  )
}
