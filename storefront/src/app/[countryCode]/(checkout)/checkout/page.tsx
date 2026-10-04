import { Metadata } from "next"
import { redirect } from "next/navigation"

import Wrapper from "@modules/checkout/components/payment-wrapper"
import CheckoutForm from "@modules/checkout/templates/checkout-form"
import CheckoutSummary from "@modules/checkout/templates/checkout-summary"
import { enrichLineItems, retrieveCart } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import { getCustomer } from "@lib/data/customer"

export const metadata: Metadata = {
  title: "Checkout",
}

const fetchCart = async (countryCode: string) => {
  const cart = await retrieveCart()
  if (!cart) {
    // No cart cookie (or the cart no longer exists): send the shopper to the
    // cart page instead of a 404.
    return redirect(`/${countryCode}/cart`)
  }

  if (cart?.items?.length) {
    const enrichedItems = await enrichLineItems(cart?.items, cart?.region_id!)
    cart.items = enrichedItems as HttpTypes.StoreCartLineItem[]
  }

  return cart
}

export default async function Checkout({
  params,
  searchParams,
}: {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ step?: string }>
}) {
  const { countryCode } = await params
  const { step } = await searchParams
  // Independent calls, so they run together (each one waits on the database).
  const [cart, customer] = await Promise.all([
    fetchCart(countryCode),
    getCustomer(),
  ])

  return (
    <div className="grid grid-cols-1 gap-6 py-8 content-container small:grid-cols-[1fr_416px] small:gap-x-10 small:py-10">
      <Wrapper cart={cart}>
        <CheckoutForm cart={cart} customer={customer} step={step} />
      </Wrapper>
      <CheckoutSummary cart={cart} />
    </div>
  )
}
