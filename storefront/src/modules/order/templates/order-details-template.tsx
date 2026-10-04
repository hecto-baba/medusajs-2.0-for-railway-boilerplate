"use client"

import { XMark } from "@medusajs/icons"
import React from "react"

import Help from "@modules/order/components/help"
import Items from "@modules/order/components/items"
import OrderDetails from "@modules/order/components/order-details"
import OrderSummary from "@modules/order/components/order-summary"
import ShippingDetails from "@modules/order/components/shipping-details"
import PaymentDetails from "@modules/order/components/payment-details"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import SellerOrders from "@modules/order/components/seller-orders"
import type { SellerOrder } from "@lib/data/orders"
import { HttpTypes } from "@medusajs/types"

type OrderDetailsTemplateProps = {
  order: HttpTypes.StoreOrder
  sellerOrders?: SellerOrder[]
}

const OrderDetailsTemplate: React.FC<OrderDetailsTemplateProps> = ({
  order,
  sellerOrders = [],
}) => {
  return (
    <div className="flex flex-col justify-center gap-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-large bg-card p-5 shadow-lift">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">
          Order details
        </h1>
        <LocalizedClientLink
          href="/account/orders"
          className="flex items-center gap-2 text-sm font-bold text-brand hover:underline"
          data-testid="back-to-overview-button"
        >
          <XMark /> Back to overview
        </LocalizedClientLink>
      </div>
      <div
        className="flex h-full w-full flex-col gap-4"
        data-testid="order-details-container"
      >
        <div className="rounded-large bg-card p-5 shadow-lift">
          <OrderDetails order={order} showStatus />
        </div>
        <Items items={order.items} />
        <SellerOrders sellerOrders={sellerOrders} />
        <ShippingDetails order={order} />
        <OrderSummary order={order} />
        <Help />
      </div>
    </div>
  )
}

export default OrderDetailsTemplate
