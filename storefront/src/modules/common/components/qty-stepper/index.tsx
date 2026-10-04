"use client"

import { clx } from "@medusajs/ui"
import React from "react"

type QtyStepperProps = {
  quantity: number
  onIncrement: () => void
  onDecrement: () => void
  /** A request for this line is in flight. Both buttons stay disabled. */
  pending?: boolean
  /** Upper limit (stock). The plus button disables at this quantity. */
  max?: number
  size?: "sm" | "lg"
  /** Text of the button shown at quantity 0. */
  addLabel?: string
  /** Product name, used for screen reader labels. */
  label?: string
  className?: string
  "data-testid"?: string
}

/**
 * ADD button that becomes a "- n +" stepper once the item is in the cart.
 * Clicks never bubble, so it is safe to place inside a card that is a link.
 */
const QtyStepper = ({
  quantity,
  onIncrement,
  onDecrement,
  pending = false,
  max,
  size = "sm",
  addLabel = "ADD",
  label,
  className,
  "data-testid": dataTestId = "qty-stepper",
}: QtyStepperProps) => {
  const stop =
    (fn: () => void) => (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.stopPropagation()
      fn()
    }

  const height =
    size === "lg" ? "h-12 min-w-[168px] text-base" : "h-9 min-w-[88px] text-sm"
  const buttonWidth = size === "lg" ? "w-12" : "w-8"

  if (quantity <= 0) {
    return (
      <button
        type="button"
        data-testid={`${dataTestId}-add`}
        aria-label={label ? `Add ${label} to cart` : "Add to cart"}
        disabled={pending}
        onClick={stop(onIncrement)}
        className={clx(
          "rounded-rounded border-[1.5px] border-brand bg-card px-4 font-extrabold tracking-wide text-brand transition-colors hover:bg-brand-soft active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60",
          height,
          className
        )}
      >
        {addLabel}
      </button>
    )
  }

  const atMax = typeof max === "number" && quantity >= max

  return (
    <span
      data-testid={dataTestId}
      className={clx(
        "inline-flex items-center justify-between rounded-rounded bg-brand font-extrabold text-brand-ink",
        height,
        className
      )}
    >
      <button
        type="button"
        data-testid={`${dataTestId}-decrement`}
        aria-label={label ? `Remove one ${label}` : "Remove one"}
        disabled={pending}
        onClick={stop(onDecrement)}
        className={clx(
          "h-full text-lg disabled:cursor-not-allowed disabled:opacity-60",
          buttonWidth
        )}
      >
        −
      </button>
      <b
        className="min-w-[1.25rem] text-center tabular-nums"
        aria-live="polite"
        data-testid={`${dataTestId}-quantity`}
      >
        {quantity}
      </b>
      <button
        type="button"
        data-testid={`${dataTestId}-increment`}
        aria-label={label ? `Add one ${label}` : "Add one"}
        disabled={pending || atMax}
        onClick={stop(onIncrement)}
        className={clx(
          "h-full text-lg disabled:cursor-not-allowed disabled:opacity-60",
          buttonWidth
        )}
      >
        +
      </button>
    </span>
  )
}

export default QtyStepper
