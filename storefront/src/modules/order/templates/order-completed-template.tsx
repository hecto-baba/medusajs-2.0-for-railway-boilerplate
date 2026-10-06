import CartTotals from "@modules/common/components/cart-totals"
import Help from "@modules/order/components/help"
import Items from "@modules/order/components/items"
import OrderDetails from "@modules/order/components/order-details"
import ShippingDetails from "@modules/order/components/shipping-details"
import PaymentDetails from "@modules/order/components/payment-details"
import SellerOrders from "@modules/order/components/seller-orders"
import TrackOrderLink from "@modules/order/components/track-order-link"
import type { SellerOrder } from "@lib/data/orders"
import { HttpTypes } from "@medusajs/types"

type OrderCompletedTemplateProps = {
  order: HttpTypes.StoreOrder
  sellerOrders?: SellerOrder[]
}

export default function OrderCompletedTemplate({
  order,
  sellerOrders = [],
}: OrderCompletedTemplateProps) {
  return (
    <div className="bg-canvas py-6 small:py-10 min-h-[calc(100vh-64px)]">
      <div className="content-container flex w-full max-w-3xl flex-col items-center">
        <div
          className="flex w-full flex-col gap-4"
          data-testid="order-complete-container"
        >
          <div className="flex flex-col items-center rounded-large bg-card p-6 text-center shadow-lift small:p-8">
            <span className="flex h-16 w-16 items-center justify-center rounded-circle bg-success text-success-ink">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
            <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight small:text-4xl">
              Order placed
            </h1>
            <p className="mt-1 text-muted">
              Thank you. Your order was placed successfully.
            </p>
            <OrderDetails order={order} centered />
            <div className="mt-4 empty:hidden">
              <TrackOrderLink order={order} />
            </div>
          </div>
          <h2 className="px-1 pt-2 font-display text-2xl font-extrabold tracking-tight">
            Summary
          </h2>
          <Items items={order.items} currencyCode={order.currency_code} />
          <SellerOrders sellerOrders={sellerOrders} />
          <div className="rounded-large bg-card p-5 shadow-lift">
            <CartTotals totals={order} />
          </div>
          <ShippingDetails order={order} />
          <PaymentDetails order={order} />
          <Help />
        </div>
      </div>
    </div>
  )
}
