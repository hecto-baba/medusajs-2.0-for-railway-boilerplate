import { clx } from "@medusajs/ui"
import React from "react"

import DiscountBadge from "@modules/common/components/discount-badge"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Price from "@modules/common/components/price"
import CardImage from "./card-image"

export type ProductCardProps = {
  title: string
  href: string
  imageUrl?: string | null
  /** Pack size or variant text under the title ("500 g", "From 4 options"). */
  unitLabel?: string | null
  amount?: number | null
  originalAmount?: number | null
  currencyCode?: string | null
  /** Add-to-cart control (a QtyStepper) or a "Select" link. */
  action?: React.ReactNode
  /** Small tag on the image corner, such as "Rent" or "Book". */
  tag?: string | null
  className?: string
  "data-testid"?: string
}

/**
 * Presentational product card. It knows nothing about the cart: the caller
 * passes the control in `action`, so the same card serves plain products,
 * rentals, bookings and search hits.
 */
const ProductCard = ({
  title,
  href,
  imageUrl,
  unitLabel,
  amount,
  originalAmount,
  currencyCode,
  action,
  tag,
  className,
  "data-testid": dataTestId = "product-card",
}: ProductCardProps) => {
  const hasDiscount =
    typeof amount === "number" &&
    typeof originalAmount === "number" &&
    originalAmount > amount
  const percent = hasDiscount
    ? ((originalAmount! - amount!) / originalAmount!) * 100
    : 0

  return (
    <div
      className={clx(
        "group relative flex h-full flex-col gap-1.5 rounded-large bg-card p-3 shadow-lift transition-transform duration-150 hover:-translate-y-0.5",
        className
      )}
      data-testid={dataTestId}
    >
      <LocalizedClientLink
        href={href}
        className="flex flex-col gap-1.5 outline-offset-4 after:absolute after:inset-0 after:content-['']"
        aria-label={title}
      >
        <div className="relative aspect-[1/0.86] overflow-hidden rounded-[12px] bg-canvas">
          <CardImage src={imageUrl} />
          {hasDiscount && (
            <DiscountBadge
              percent={percent}
              className="absolute left-2.5 top-0 rounded-b-base rounded-t-none px-1.5 pb-1.5 pt-1"
            />
          )}
          {tag && (
            <span className="absolute right-2 top-2 rounded-circle bg-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-canvas">
              {tag}
            </span>
          )}
        </div>
        <span
          className="line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-tight"
          data-testid="product-title"
        >
          {title}
        </span>
        {unitLabel && <span className="text-xs text-muted">{unitLabel}</span>}
      </LocalizedClientLink>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-2 pt-1">
        {typeof amount === "number" && currencyCode ? (
          <Price
            amount={amount}
            originalAmount={originalAmount}
            currencyCode={currencyCode}
            size="md"
            className="flex-col !items-start gap-0"
          />
        ) : (
          <span className="text-xs text-muted">No price</span>
        )}
        {/* Sits above the link overlay so it stays clickable. */}
        <div className="relative z-10">{action}</div>
      </div>
    </div>
  )
}

export default ProductCard
