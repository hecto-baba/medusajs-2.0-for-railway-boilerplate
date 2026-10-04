import { clx } from "@medusajs/ui"

type DiscountBadgeProps = {
  percent: number
  className?: string
  "data-testid"?: string
}

/** "N% OFF" tag. Renders nothing for a discount that rounds to 0. */
const DiscountBadge = ({
  percent,
  className,
  "data-testid": dataTestId = "discount-badge",
}: DiscountBadgeProps) => {
  const value = Math.round(percent)

  if (!Number.isFinite(value) || value < 1) {
    return null
  }

  return (
    <span
      data-testid={dataTestId}
      className={clx(
        "inline-flex items-center rounded-soft bg-pop px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-pop-ink",
        className
      )}
    >
      {value}% off
    </span>
  )
}

export default DiscountBadge
