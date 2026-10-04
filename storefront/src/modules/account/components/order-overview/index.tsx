"use client"

import { Button } from "@medusajs/ui"

import OrderCard from "../order-card"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"

const OrderOverview = ({ orders }: { orders: HttpTypes.StoreOrder[] }) => {
  if (orders?.length) {
    return (
      <div className="flex flex-col gap-y-4 w-full">
        {orders.map((o) => (
          <div key={o.id}>
            <OrderCard order={o} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      className="w-full flex flex-col items-center gap-y-3 rounded-large bg-card p-8 text-center shadow-lift"
      data-testid="no-orders-container"
    >
      <h2 className="font-display text-xl font-extrabold tracking-tight">
        Nothing to see here
      </h2>
      <p className="text-muted">
        You don&apos;t have any orders yet, let us change that {":)"}
      </p>
      <div className="mt-2">
        <LocalizedClientLink href="/" passHref>
          <Button
            data-testid="continue-shopping-button"
            className="!rounded-large !border-0 !bg-brand !font-extrabold !text-brand-ink !shadow-none hover:!opacity-90"
          >
            Continue shopping
          </Button>
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default OrderOverview
