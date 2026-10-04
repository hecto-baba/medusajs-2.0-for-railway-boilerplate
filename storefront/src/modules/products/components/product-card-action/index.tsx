"use client"

import { useCart } from "@lib/context/cart-context"
import Chip from "@modules/common/components/chip"
import QtyStepper from "@modules/common/components/qty-stepper"

type ProductCardActionProps = {
  variantId: string
  title: string
  /** Stock limit, when the variant tracks inventory. */
  max?: number
  soldOut?: boolean
}

/**
 * One-tap ADD for a plain single-option product. Reads and writes the shared
 * cart, so the same product shows the same quantity in every card, in the
 * drawer and in the header.
 */
const ProductCardAction = ({
  variantId,
  title,
  max,
  soldOut,
}: ProductCardActionProps) => {
  const cart = useCart()
  const quantity = cart.quantityFor(variantId)

  if (soldOut && quantity === 0) {
    return <Chip tone="muted">Sold out</Chip>
  }

  return (
    <QtyStepper
      quantity={quantity}
      max={max}
      label={title}
      pending={cart.isPending(variantId)}
      onIncrement={() => cart.increment(variantId)}
      onDecrement={() => cart.decrement(variantId)}
      data-testid="card-stepper"
    />
  )
}

export default ProductCardAction
