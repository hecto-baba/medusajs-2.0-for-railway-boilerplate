import { clx } from "@medusajs/ui"

import { getPercentageDiff } from "@lib/util/get-precentage-diff"
import { getPricesForVariant } from "@lib/util/get-product-price"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"

type LineItemPriceProps = {
  item: HttpTypes.StoreCartLineItem | HttpTypes.StoreOrderLineItem
  style?: "default" | "tight"
  // Cart/order currency: needed for lines with no variant (the rental
  // deposit), which have no variant price to read it from.
  currencyCode?: string
}

const LineItemPrice = ({
  item,
  style = "default",
  currencyCode,
}: LineItemPriceProps) => {
  // A catalog-less line (the rental deposit) has no variant to price from;
  // its charged amount is just its own unit price.
  if (!item.variant) {
    return (
      <div className="flex flex-col gap-x-2 text-muted items-end">
        <span className="text-base-regular" data-testid="product-price">
          {convertToLocale({
            amount: (item.unit_price ?? 0) * item.quantity,
            currency_code: currencyCode ?? "",
          })}
        </span>
      </div>
    )
  }

  const { currency_code, calculated_price_number, original_price_number } =
    getPricesForVariant(item.variant) ?? {}

  const adjustmentsSum = (item.adjustments || []).reduce(
    (acc, adjustment) => adjustment.amount + acc,
    0
  )

  const originalPrice = original_price_number * item.quantity
  const currentPrice = calculated_price_number * item.quantity - adjustmentsSum
  const hasReducedPrice = currentPrice < originalPrice

  return (
    <div className="flex flex-col gap-x-2 text-muted items-end">
      <div className="text-left">
        {hasReducedPrice && (
          <>
            <p>
              {style === "default" && (
                <span className="text-muted">Original: </span>
              )}
              <span
                className="line-through text-muted"
                data-testid="product-original-price"
              >
                {convertToLocale({
                  amount: originalPrice,
                  currency_code,
                })}
              </span>
            </p>
            {style === "default" && (
              <span className="text-brand">
                -{getPercentageDiff(originalPrice, currentPrice || 0)}%
              </span>
            )}
          </>
        )}
        <span
          className={clx("text-base-regular", {
            "text-brand": hasReducedPrice,
          })}
          data-testid="product-price"
        >
          {convertToLocale({
            amount: currentPrice,
            currency_code,
          })}
        </span>
      </div>
    </div>
  )
}

export default LineItemPrice
