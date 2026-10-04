"use client"

import { Button } from "@medusajs/ui"
import { useMemo } from "react"

import Thumbnail from "@modules/products/components/thumbnail"
import Chip from "@modules/common/components/chip"
import TrackOrderLink from "@modules/order/components/track-order-link"
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
    <div
      className="flex flex-col rounded-large bg-card p-5 shadow-lift"
      data-testid="order-card"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="font-display text-lg font-extrabold tracking-tight">
          Order #<span data-testid="order-display-id">{order.display_id}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {fulfillmentStatus === "delivered" ? (
            <Chip tone="success">Delivered</Chip>
          ) : fulfillmentStatus === "shipped" ||
            fulfillmentStatus === "partially_shipped" ? (
            <Chip tone="pop">In Transit</Chip>
          ) : fulfillmentStatus === "fulfilled" ||
            fulfillmentStatus === "partially_fulfilled" ? (
            <Chip tone="pop">Packed</Chip>
          ) : (
            <Chip tone="muted">Confirmed</Chip>
          )}

          {paymentStatus === "captured" || paymentStatus === "paid" ? (
            <Chip tone="success">Paid</Chip>
          ) : paymentStatus === "authorized" ||
            paymentStatus === "partially_authorized" ? (
            <Chip tone="muted">Authorized</Chip>
          ) : (
            <Chip tone="warning">Awaiting Payment</Chip>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        <span data-testid="order-created-at">
          {new Date(order.created_at).toDateString()}
        </span>
        <span>{`${numberOfLines} ${numberOfLines > 1 ? "items" : "item"}`}</span>
        <span
          className="ml-auto font-display text-xl font-extrabold tracking-tight text-ink"
          data-testid="order-amount"
        >
          {convertToLocale({
            amount: order.total,
            currency_code: order.currency_code,
          })}
        </span>
      </div>
      <div className="my-4 grid grid-cols-2 gap-4 small:grid-cols-4">
        {order.items?.slice(0, 3).map((i) => {
          return (
            <div
              key={i.id}
              className="flex flex-col gap-y-2"
              data-testid="order-item"
            >
              <Thumbnail thumbnail={i.thumbnail} images={[]} size="full" />
              <div className="flex items-center text-sm">
                <span className="truncate font-bold" data-testid="item-title">
                  {i.title}
                </span>
                <span className="ml-2 text-muted">x</span>
                <span className="text-muted" data-testid="item-quantity">
                  {i.quantity}
                </span>
              </div>
            </div>
          )
        })}
        {numberOfProducts > 4 && (
          <div className="flex h-full w-full flex-col items-center justify-center">
            <span className="text-sm text-muted">+ {numberOfLines - 4}</span>
            <span className="text-sm text-muted">more</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <TrackOrderLink order={order} />
        <LocalizedClientLink href={`/account/orders/details/${order.id}`}>
          <Button
            data-testid="order-details-link"
            variant="secondary"
            className="!rounded-large !border-[1.5px] !border-brand !bg-card !font-extrabold !text-brand !shadow-none hover:!bg-brand-soft"
          >
            See details
          </Button>
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default OrderCard
