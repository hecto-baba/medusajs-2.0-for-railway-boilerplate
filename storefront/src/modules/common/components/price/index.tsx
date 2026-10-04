import { clx } from "@medusajs/ui"

import { convertToLocale } from "@lib/util/money"
import DiscountBadge from "@modules/common/components/discount-badge"

type PriceProps = {
  amount: number
  /** Price before discount. Shown struck through when higher than `amount`. */
  originalAmount?: number | null
  currencyCode: string
  size?: "sm" | "md" | "lg" | "xl"
  /** Show the "N% OFF" badge next to the price. */
  showBadge?: boolean
  className?: string
  "data-testid"?: string
}

const SIZE = {
  sm: { current: "text-sm font-bold", original: "text-xs" },
  md: { current: "text-base font-bold", original: "text-xs" },
  lg: { current: "text-2xl font-display font-extrabold", original: "text-sm" },
  xl: {
    current: "text-4xl font-display font-extrabold tracking-tight",
    original: "text-base",
  },
}

const Price = ({
  amount,
  originalAmount,
  currencyCode,
  size = "md",
  showBadge = false,
  className,
  "data-testid": dataTestId = "price",
}: PriceProps) => {
  const hasDiscount =
    typeof originalAmount === "number" && originalAmount > amount
  const percent = hasDiscount
    ? ((originalAmount - amount) / originalAmount) * 100
    : 0

  return (
    <span
      data-testid={dataTestId}
      className={clx(
        "inline-flex flex-wrap items-baseline gap-x-2 tabular-nums",
        className
      )}
    >
      <span className={SIZE[size].current} data-testid={`${dataTestId}-current`}>
        {convertToLocale({ amount, currency_code: currencyCode })}
      </span>
      {hasDiscount && (
        <span
          className={clx("text-muted line-through", SIZE[size].original)}
          data-testid={`${dataTestId}-original`}
        >
          {convertToLocale({
            amount: originalAmount,
            currency_code: currencyCode,
          })}
        </span>
      )}
      {hasDiscount && showBadge && <DiscountBadge percent={percent} />}
    </span>
  )
}

export default Price
