import { convertToLocale } from "@lib/util/money"

type FreeDeliveryBarProps = {
  /** Current item subtotal, in the same major units as `threshold`. */
  subtotal: number
  /** Amount at which delivery becomes free. The bar hides when not set. */
  threshold?: number | null
  currencyCode: string
}

const FreeDeliveryBar = ({
  subtotal,
  threshold,
  currencyCode,
}: FreeDeliveryBarProps) => {
  if (!threshold || threshold <= 0) {
    return null
  }

  const remaining = Math.max(0, threshold - subtotal)
  const percent = Math.min(100, (subtotal / threshold) * 100)

  return (
    <div
      className="rounded-large bg-card p-3.5 shadow-lift"
      data-testid="free-delivery-bar"
    >
      <p className="text-sm font-bold">
        {remaining > 0
          ? `Add ${convertToLocale({ amount: remaining, currency_code: currencyCode })} more for free delivery`
          : "You unlocked free delivery"}
      </p>
      <div
        className="mt-2.5 h-1.5 overflow-hidden rounded-circle bg-line"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
      >
        <div
          className="h-full rounded-circle bg-success transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

export default FreeDeliveryBar
