import { clx } from "@medusajs/ui"
import React from "react"

type ChipProps = {
  tone?: "success" | "warning" | "muted" | "pop"
  children: React.ReactNode
  icon?: React.ReactNode
  className?: string
  "data-testid"?: string
}

const TONE = {
  success: "bg-success-soft text-success",
  warning: "bg-brand-soft text-brand",
  muted: "bg-canvas text-muted",
  pop: "bg-pop text-pop-ink",
}

/** Small pill for status and short facts ("9 mins", "Open now", "Booked"). */
const Chip = ({
  tone = "success",
  children,
  icon,
  className,
  "data-testid": dataTestId,
}: ChipProps) => (
  <span
    data-testid={dataTestId}
    className={clx(
      "inline-flex items-center gap-1.5 rounded-circle px-2.5 py-1 text-xs font-bold leading-none",
      TONE[tone],
      className
    )}
  >
    {icon}
    {children}
  </span>
)

export default Chip
