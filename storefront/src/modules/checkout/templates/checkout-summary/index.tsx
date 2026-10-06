import { Heading } from "@medusajs/ui"

import ItemsPreviewTemplate from "@modules/cart/templates/preview"
import DiscountCode from "@modules/checkout/components/discount-code"
import CartTotals from "@modules/common/components/cart-totals"
import Divider from "@modules/common/components/divider"

const CheckoutSummary = ({ cart }: { cart: any }) => {
  return (
    <div className="flex flex-col-reverse gap-y-8 py-8 small:sticky small:top-6 small:flex-col small:py-0">
      <div className="flex w-full flex-col rounded-large bg-card p-5 shadow-lift small:p-6">
        <Divider className="my-6 small:hidden" />
        <Heading
          level="h2"
          className="flex flex-row items-baseline font-display text-2xl font-extrabold tracking-tight"
        >
          In your Cart
        </Heading>
        <Divider className="my-6" />
        <CartTotals totals={cart} />
        <ItemsPreviewTemplate
          items={cart?.items}
          currencyCode={cart?.currency_code}
        />
        <div className="my-6">
          <DiscountCode cart={cart} />
        </div>
      </div>
    </div>
  )
}

export default CheckoutSummary
