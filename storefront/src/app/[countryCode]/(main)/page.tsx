import { Metadata } from "next"
import { Suspense } from "react"

import { getCollectionsWithProducts } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"
import { getStoreName } from "@lib/util/env"
import CategoryTiles from "@modules/home/components/category-tiles"
import FeaturedProducts from "@modules/home/components/featured-products"
import Hero from "@modules/home/components/hero"
import LatestProducts from "@modules/home/components/latest-products"
import VerticalCards from "@modules/home/components/vertical-cards"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"

export const metadata: Metadata = {
  title: getStoreName(),
  description: `Shop the latest at ${getStoreName()}.`,
}

export default async function Home({
  params,
}: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await params
  const [collections, region] = await Promise.all([
    getCollectionsWithProducts(countryCode),
    getRegion(countryCode),
  ])

  if (!collections || !region) {
    return null
  }

  // The seed creates categories but no collections, so on a fresh store the
  // featured section would render nothing at all.
  const hasFeaturedProducts = collections.some(
    (collection) => collection.products?.length
  )

  return (
    <div className="content-container pb-4 pt-5 small:pt-6">
      <Hero />
      <Suspense fallback={null}>
        <CategoryTiles />
      </Suspense>
      {hasFeaturedProducts ? (
        <div className="flex flex-col" data-testid="featured-products">
          <FeaturedProducts collections={collections} region={region} />
        </div>
      ) : (
        <Suspense fallback={<SkeletonProductGrid />}>
          <LatestProducts countryCode={countryCode} region={region} />
        </Suspense>
      )}
      <VerticalCards />
    </div>
  )
}
