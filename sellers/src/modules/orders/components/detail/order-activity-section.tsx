"use client"

import type { VendorOrderDetail } from "@lib/data/vendor-client"
import { Container, Heading, Text, Tooltip, clx } from "@medusajs/ui"
import type { ReactNode } from "react"
import {
  getFullDate,
  getPayments,
  getRelativeDate,
  getStylizedAmount,
  getTotalPending,
} from "./order-format"

/**
 * The Activity card - the admin's OrderActivitySection look (dot-and-line
 * timeline, newest first, relative time with the full date on hover).
 *
 * The admin builds its timeline from the order's change history plus payments
 * and fulfillments. The seller route does not expose the change history, so
 * this one is built from what the order itself carries: placed, payments and
 * refunds, fulfilments, shipping, delivery and cancellation.
 */

type Entry = { title: string; timestamp?: string | null; children?: ReactNode }

const Line = ({
  entry,
  isFirst,
}: {
  entry: Entry
  isFirst: boolean
}) => (
  <div className="grid grid-cols-[20px_1fr] items-start gap-2">
    <div className="flex size-full flex-col items-center gap-y-0.5">
      <div className="flex size-5 items-center justify-center">
        <div className="bg-ui-bg-base shadow-borders-base flex size-2.5 items-center justify-center rounded-full">
          <div className="bg-ui-tag-neutral-icon size-1.5 rounded-full" />
        </div>
      </div>
      {!isFirst && <div className="bg-ui-border-base w-px flex-1" />}
    </div>
    <div className={clx({ "pb-4": !isFirst })}>
      <div className="flex items-center justify-between">
        <Text size="small" leading="compact" weight="plus">
          {entry.title}
        </Text>
        {entry.timestamp && (
          <Tooltip content={getFullDate(entry.timestamp, true)}>
            <Text size="small" leading="compact" className="text-ui-fg-subtle text-right">
              {getRelativeDate(entry.timestamp)}
            </Text>
          </Tooltip>
        )}
      </div>
      <div>{entry.children}</div>
    </div>
  </div>
)

const buildEntries = (order: VendorOrderDetail): Entry[] => {
  const currency = order.currency_code
  const entries: Entry[] = []
  const amount = (value: number) => (
    <Text size="small" leading="compact" className="text-ui-fg-subtle">
      {getStylizedAmount(value, currency)}
    </Text>
  )
  const showMoney = !order.is_mixed

  entries.push({
    title: "Order placed",
    timestamp: order.created_at,
    children: showMoney ? amount(order.total) : undefined,
  })

  if (showMoney) {
    const pending = getTotalPending(order)
    if (order.status !== "canceled" && pending > 0) {
      entries.push({ title: "Awaiting payment", timestamp: order.created_at, children: amount(pending) })
    }

    for (const payment of getPayments(order)) {
      if (payment.captured_at) {
        entries.push({
          title: "Payment captured",
          timestamp: payment.captured_at,
          children: amount(payment.amount),
        })
      }
      for (const refund of payment.refunds ?? []) {
        entries.push({
          title: "Payment refunded",
          timestamp: refund.created_at,
          children: amount(refund.amount),
        })
      }
    }
  }

  for (const f of showMoney ? order.fulfillments ?? [] : []) {
    if (f.created_at) entries.push({ title: "Fulfillment created", timestamp: f.created_at })
    if (f.shipped_at) entries.push({ title: "Fulfillment shipped", timestamp: f.shipped_at })
    if (f.delivered_at) entries.push({ title: "Fulfillment delivered", timestamp: f.delivered_at })
    if (f.canceled_at) entries.push({ title: "Fulfillment canceled", timestamp: f.canceled_at })
  }

  if (order.canceled_at) {
    entries.push({ title: "Order canceled", timestamp: order.canceled_at })
  }

  return entries.sort(
    (a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime()
  )
}

export const OrderActivitySection = ({ order }: { order: VendorOrderDetail }) => {
  const entries = buildEntries(order)

  return (
    <Container className="flex flex-col gap-y-8 px-6 py-4">
      <div className="flex items-center justify-between">
        <Heading level="h2">Activity</Heading>
      </div>
      <div className="flex flex-col gap-y-0.5">
        {entries.map((entry, index) => (
          <Line key={index} entry={entry} isFirst={index === entries.length - 1} />
        ))}
      </div>
    </Container>
  )
}
