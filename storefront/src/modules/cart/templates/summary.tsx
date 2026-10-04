"use client"

import { Heading } from "@medusajs/ui"

import CartTotals from "@modules/common/components/cart-totals"
import Divider from "@modules/common/components/divider"
import DiscountCode from "@modules/checkout/components/discount-code"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"
import { RequestQuoteButton } from "../components/request-quote-button"
import { isNoShippingCart } from "types/appointment"

type SummaryProps = {
  cart: HttpTypes.StoreCart & {
    promotions: HttpTypes.StorePromotion[]
  }
}

function getCheckoutStep(cart: HttpTypes.StoreCart) {
  // A cart with nothing to ship collects contact details only, so a street
  // address is never what is missing from it, and it has no delivery step.
  const noShipping = isNoShippingCart(cart?.items)

  if (
    !(noShipping
      ? cart?.billing_address?.country_code
      : cart?.shipping_address?.address_1) ||
    !cart.email
  ) {
    return "address"
  } else if (!noShipping && cart?.shipping_methods?.length === 0) {
    return "delivery"
  } else {
    return "payment"
  }
}

const Summary = ({ cart }: SummaryProps) => {
  const step = getCheckoutStep(cart)

  return (
    <div className="flex flex-col gap-y-4">
      <Heading
        level="h2"
        className="font-display text-3xl font-extrabold tracking-tight"
      >
        Summary
      </Heading>
      <DiscountCode cart={cart} />
      <Divider />
      <CartTotals totals={cart} />
      <LocalizedClientLink
        href={"/checkout?step=" + step}
        data-testid="checkout-button"
        className="flex h-12 w-full items-center justify-center rounded-large bg-brand text-base font-extrabold text-brand-ink transition-opacity hover:opacity-90"
      >
        Go to checkout
      </LocalizedClientLink>
      <RequestQuoteButton cart={cart} />
    </div>
  )
}

export default Summary
