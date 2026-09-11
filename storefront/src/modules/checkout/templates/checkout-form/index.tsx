import { listCartShippingMethods } from "@lib/data/fulfillment"
import { listCartPaymentMethods } from "@lib/data/payment"
import { HttpTypes } from "@medusajs/types"
import Addresses from "@modules/checkout/components/addresses"
import Payment from "@modules/checkout/components/payment"
import Review from "@modules/checkout/components/review"
import Shipping from "@modules/checkout/components/shipping"
import TicketAddresses from "@modules/checkout/components/ticket-addresses"
import { isTicketLineItem } from "types/ticket"

export default async function CheckoutForm({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) {
  if (!cart) {
    return null
  }

  // A cart of nothing but tickets has nothing to ship: its variants are
  // created with requires_shipping false, so no shipping option matches it and
  // asking for a delivery address would be asking for something unused.
  //
  // Deliberately "every item is a ticket" rather than "any item is": a cart
  // mixing tickets with a physical product still has to be shipped, and must
  // keep the full checkout.
  const items = cart.items ?? []
  const isTicketsOnly =
    items.length > 0 && items.every((item) => isTicketLineItem(item.metadata))

  const paymentMethods = await listCartPaymentMethods(cart.region?.id ?? "")

  if (!paymentMethods) {
    return null
  }

  if (isTicketsOnly) {
    return (
      <div>
        <div className="w-full grid grid-cols-1 gap-y-8">
          <div>
            <TicketAddresses cart={cart} customer={customer} />
          </div>

          <div>
            <Payment cart={cart} availablePaymentMethods={paymentMethods} />
          </div>

          <div>
            <Review cart={cart} />
          </div>
        </div>
      </div>
    )
  }

  const shippingMethods = await listCartShippingMethods(cart.id)

  if (!shippingMethods) {
    return null
  }

  return (
    <div>
      <div className="w-full grid grid-cols-1 gap-y-8">
        <div>
          <Addresses cart={cart} customer={customer} />
        </div>

        <div>
          <Shipping cart={cart} availableShippingMethods={shippingMethods} />
        </div>

        <div>
          <Payment cart={cart} availablePaymentMethods={paymentMethods} />
        </div>

        <div>
          <Review cart={cart} />
        </div>
      </div>
    </div>
  )
}
