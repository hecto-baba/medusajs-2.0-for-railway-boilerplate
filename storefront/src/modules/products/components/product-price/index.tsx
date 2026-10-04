import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import DiscountBadge from "@modules/common/components/discount-badge"

export default function ProductPrice({
  product,
  variant,
}: {
  product: HttpTypes.StoreProduct
  variant?: HttpTypes.StoreProductVariant
}) {
  const { cheapestPrice, variantPrice } = getProductPrice({
    product,
    variantId: variant?.id,
  })

  const selectedPrice = variant ? variantPrice : cheapestPrice

  if (!selectedPrice) {
    return <div className="block h-10 w-36 animate-pulse rounded-soft bg-line" />
  }

  const onSale = selectedPrice.price_type === "sale"

  return (
    <div className="flex flex-col gap-1 text-ink">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 tabular-nums">
        <span className="font-display text-4xl font-extrabold tracking-tight">
          {!variant && (
            <span className="mr-1.5 text-base font-bold text-muted">From</span>
          )}
          <span
            data-testid="product-price"
            data-value={selectedPrice.calculated_price_number}
          >
            {selectedPrice.calculated_price}
          </span>
        </span>
        {onSale && (
          <>
            <span
              className="text-base text-muted line-through"
              data-testid="original-product-price"
              data-value={selectedPrice.original_price_number}
            >
              {selectedPrice.original_price}
            </span>
            <DiscountBadge
              percent={Number(selectedPrice.percentage_diff)}
              className="px-2 py-1 text-xs"
            />
          </>
        )}
      </div>
      <span className="text-xs text-muted">Inclusive of applicable taxes</span>
    </div>
  )
}
