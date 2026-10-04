import Product from "../product-preview"
import { getRegion } from "@lib/data/regions"
import { getProductsList } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import SectionHeader from "@modules/common/components/section-header"

type RelatedProductsProps = {
  product: HttpTypes.StoreProduct
  countryCode: string
}

export default async function RelatedProducts({
  product,
  countryCode,
}: RelatedProductsProps) {
  const region = await getRegion(countryCode)

  if (!region) {
    return null
  }

  // edit this function to define your related products logic
  const queryParams: HttpTypes.StoreProductListParams = {}
  queryParams.region_id = region.id
  if (product.collection_id) {
    queryParams.collection_id = [product.collection_id]
  }
  // The list endpoint filters by tag id, not by tag value.
  const tagIds = product.tags?.map((t) => t.id).filter(Boolean) as
    | string[]
    | undefined
  if (tagIds?.length) {
    queryParams.tag_id = tagIds
  }
  queryParams.is_giftcard = false

  const products = await getProductsList({
    queryParams,
    countryCode,
  }).then(({ response }) => {
    return response.products.filter(
      (responseProduct) => responseProduct.id !== product.id
    )
  })

  if (!products.length) {
    return null
  }

  return (
    <div className="product-page-constraint">
      <SectionHeader title="You might also like" className="!pt-0" />
      <ul className="grid grid-cols-2 gap-3 xsmall:grid-cols-3 small:gap-4 medium:grid-cols-4 large:grid-cols-5">
        {products.slice(0, 10).map((product) => (
          <li key={product.id}>
            {region && <Product region={region} product={product} />}
          </li>
        ))}
      </ul>
    </div>
  )
}
