import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type ProductInfoProps = {
  product: HttpTypes.StoreProduct
}

const ProductInfo = ({ product }: ProductInfoProps) => {
  return (
    <div id="product-info" className="flex flex-col gap-y-3">
      {product.collection && (
        <LocalizedClientLink
          href={`/collections/${product.collection.handle}`}
          className="w-fit rounded-circle bg-success-soft px-3 py-1 text-xs font-bold text-success hover:opacity-80"
        >
          {product.collection.title}
        </LocalizedClientLink>
      )}
      <h1
        className="font-display text-3xl font-extrabold leading-[1.05] tracking-tight small:text-4xl"
        data-testid="product-title"
      >
        {product.title}
      </h1>
      {product.description && (
        <p
          className="whitespace-pre-line text-sm leading-relaxed text-muted"
          data-testid="product-description"
        >
          {product.description}
        </p>
      )}
    </div>
  )
}

export default ProductInfo
