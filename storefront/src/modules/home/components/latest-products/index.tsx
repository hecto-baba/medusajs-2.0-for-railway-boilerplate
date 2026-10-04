import { HttpTypes } from "@medusajs/types"

import { getProductsList } from "@lib/data/products"
import SectionHeader from "@modules/common/components/section-header"
import ProductPreview from "@modules/products/components/product-preview"

/**
 * Homepage fallback for stores that have no collections yet.
 *
 * The featured section is driven entirely by collections, but the seed script
 * creates categories only, so a freshly deployed store had a hero and then an
 * empty page. This shows the newest products instead, so the homepage is never
 * blank while the store still has products.
 */
export default async function LatestProducts({
  countryCode,
  region,
}: {
  countryCode: string
  region: HttpTypes.StoreRegion
}) {
  const { response } = await getProductsList({
    queryParams: { limit: 10 },
    countryCode,
  })

  if (!response.products.length) {
    return null
  }

  return (
    <section>
      <SectionHeader title="Latest products" href="/store" linkLabel="View all" />
      <ul
        className="grid grid-cols-2 gap-3 xsmall:grid-cols-3 small:gap-4 medium:grid-cols-4 large:grid-cols-5"
        data-testid="latest-products"
      >
        {response.products.map((product) => (
          <li key={product.id}>
            <ProductPreview product={product} region={region} isFeatured />
          </li>
        ))}
      </ul>
    </section>
  )
}
