"use client"

import { Badge, Button } from "@medusajs/ui"
import { useMemo } from "react"

import Thumbnail from "@modules/products/components/thumbnail"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"

type OrderCardProps = {
  order: HttpTypes.StoreOrder
}

const OrderCard = ({ order }: OrderCardProps) => {
  const fulfillmentStatus = ((order as any).fulfillment_status || "not_fulfilled").toLowerCase()
  const paymentStatus = ((order as any).payment_status || "not_paid").toLowerCase()

  const numberOfLines = useMemo(() => {
    return (
      order.items?.reduce((acc, item) => {
        return acc + item.quantity
      }, 0) ?? 0
    )
  }, [order])

  const numberOfProducts = useMemo(() => {
    return order.items?.length ?? 0
  }, [order])

  return (
    <div className="bg-white flex flex-col p-4 sm:p-6 rounded-lg border shadow-sm" data-testid="order-card">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <div className="uppercase text-large-semi font-mono">
          #<span data-testid="order-display-id">{order.display_id}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {fulfillmentStatus === "delivered" ? (
            <Badge color="green" size="xsmall" className="gap-1 font-semibold">
              🚚 Delivered
            </Badge>
          ) : (fulfillmentStatus === "shipped" || fulfillmentStatus === "partially_shipped") ? (
            <Badge color="blue" size="xsmall" className="gap-1 font-semibold">
              📦 In Transit
            </Badge>
          ) : (fulfillmentStatus === "fulfilled" || fulfillmentStatus === "partially_fulfilled") ? (
            <Badge color="purple" size="xsmall" className="gap-1 font-semibold">
              📦 Packed
            </Badge>
          ) : (
            <Badge color="grey" size="xsmall" className="gap-1">
              🕒 Confirmed
            </Badge>
          )}

          {(paymentStatus === "captured" || paymentStatus === "paid") ? (
            <Badge color="green" size="xsmall" className="gap-1 font-semibold">
              💳 Paid
            </Badge>
          ) : (paymentStatus === "authorized" || paymentStatus === "partially_authorized") ? (
            <Badge color="blue" size="xsmall" className="gap-1">
              💳 Authorized
            </Badge>
          ) : (
            <Badge color="orange" size="xsmall" className="gap-1">
              ⏳ Awaiting Payment
            </Badge>
          )}
        </div>
      </div>
      <div className="flex items-center divide-x divide-gray-200 text-small-regular text-ui-fg-base">
        <span className="pr-2" data-testid="order-created-at">
          {new Date(order.created_at).toDateString()}
        </span>
        <span className="px-2" data-testid="order-amount">
          {convertToLocale({
            amount: order.total,
            currency_code: order.currency_code,
          })}
        </span>
        <span className="pl-2">{`${numberOfLines} ${
          numberOfLines > 1 ? "items" : "item"
        }`}</span>
      </div>
      <div className="grid grid-cols-2 small:grid-cols-4 gap-4 my-4">
        {order.items?.slice(0, 3).map((i) => {
          return (
            <div
              key={i.id}
              className="flex flex-col gap-y-2"
              data-testid="order-item"
            >
              <Thumbnail thumbnail={i.thumbnail} images={[]} size="full" />
              <div className="flex items-center text-small-regular text-ui-fg-base">
                <span
                  className="text-ui-fg-base font-semibold"
                  data-testid="item-title"
                >
                  {i.title}
                </span>
                <span className="ml-2">x</span>
                <span data-testid="item-quantity">{i.quantity}</span>
              </div>
            </div>
          )
        })}
        {numberOfProducts > 4 && (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <span className="text-small-regular text-ui-fg-base">
              + {numberOfLines - 4}
            </span>
            <span className="text-small-regular text-ui-fg-base">more</span>
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <LocalizedClientLink href={`/account/orders/details/${order.id}`}>
          <Button data-testid="order-details-link" variant="secondary">
            See details
          </Button>
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default OrderCard
