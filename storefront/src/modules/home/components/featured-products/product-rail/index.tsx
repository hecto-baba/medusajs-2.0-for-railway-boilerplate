import { HttpTypes } from "@medusajs/types"

import SectionHeader from "@modules/common/components/section-header"
import ProductPreview from "@modules/products/components/product-preview"

export default function ProductRail({
  collection,
  region,
}: {
  collection: HttpTypes.StoreCollection
  region: HttpTypes.StoreRegion
}) {
  const { products } = collection

  if (!products?.length) {
    return null
  }

  return (
    <section data-testid="home-rail">
      <SectionHeader
        title={collection.title}
        href={`/collections/${collection.handle}`}
        linkLabel="View all"
      />
      <ul className="grid grid-cols-2 gap-3 xsmall:grid-cols-3 small:gap-4 medium:grid-cols-4 large:grid-cols-5">
        {products.slice(0, 5).map((product) => (
          <li key={product.id}>
            {/* @ts-ignore */}
            <ProductPreview product={product} region={region} isFeatured />
          </li>
        ))}
      </ul>
    </section>
  )
}
