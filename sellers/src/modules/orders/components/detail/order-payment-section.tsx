"use client"

import type { VendorOrderDetail, VendorOrderRefund } from "@lib/data/vendor-client"
import { ArrowDownRightMini, DocumentText } from "@medusajs/icons"
import { Container, Heading, StatusBadge, Text, Tooltip } from "@medusajs/ui"
import {
  displayId,
  formatDateTime,
  getLocaleAmount,
  getOrderPaymentStatus,
  getPayments,
  getStylizedAmount,
  getTotalCaptured,
  getTotalPending,
} from "./order-format"

/**
 * The Payments card - ported from the admin's OrderPaymentSection: a header
 * with the payment status, one row per payment (id, date, provider, status,
 * amount) with its refunds beneath, and the paid / pending totals. Capture,
 * refund and credit-line actions are not part of this view.
 *
 * Not shown at all on an older order shared with other sellers: payments cover
 * the whole order. A seller's own split order carries only the buyer's payment
 * status (the buyer paid once, on the parent order), so there is a status and
 * no rows.
 */

const Refund = ({ refund, currencyCode }: { refund: VendorOrderRefund; currencyCode: string }) => (
  <div className="bg-ui-bg-subtle text-ui-fg-subtle grid grid-cols-[1fr_1fr_1fr_20px] items-center gap-x-4 px-6 py-4">
    <div className="flex flex-row">
      <div className="self-center pr-3">
        <ArrowDownRightMini className="text-ui-fg-muted" />
      </div>
      <div>
        <Text size="small" leading="compact" weight="plus">
          Refund
          {refund.note && (
            <Tooltip content={refund.note}>
              <DocumentText className="text-ui-tag-neutral-icon ml-1 inline" />
            </Tooltip>
          )}
        </Text>
        <Text size="small" leading="compact">
          {formatDateTime(refund.created_at)}
        </Text>
      </div>
    </div>
    <div />
    <div className="flex items-center justify-end">
      <Text size="small" leading="compact">
        - {getLocaleAmount(refund.amount, currencyCode)}
      </Text>
    </div>
  </div>
)

export const OrderPaymentSection = ({ order }: { order: VendorOrderDetail }) => {
  if (order.is_mixed) return null

  const payment = getOrderPaymentStatus(order)
  const payments = getPayments(order).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  const pending = getTotalPending(order)

  return (
    <Container className="divide-y divide-dashed p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Payments</Heading>
        <StatusBadge color={payment.color} className="text-nowrap">
          {payment.label}
        </StatusBadge>
      </div>

      {payments.length > 0 && (
        <div className="flex flex-col divide-y divide-dashed">
          {payments.map((p) => {
            const [status, color] = p.canceled_at
              ? (["Canceled", "red"] as const)
              : p.captured_at
                ? (["Captured", "green"] as const)
                : (["Pending", "orange"] as const)

            return (
              <div key={p.id} className="divide-y divide-dashed">
                <div className="text-ui-fg-subtle grid grid-cols-[1fr_1fr_1fr_20px] items-center gap-x-4 px-6 py-4 sm:grid-cols-[1fr_1fr_1fr_1fr_20px]">
                  <div className="w-full min-w-[60px] overflow-hidden">
                    <Text size="small" leading="compact" weight="plus" className="truncate">
                      {displayId(p.id)}
                    </Text>
                    <Text size="small" leading="compact">
                      {formatDateTime(p.created_at)}
                    </Text>
                  </div>
                  <div className="hidden items-center justify-end sm:flex">
                    <Text size="small" leading="compact" className="capitalize">
                      {p.provider_id}
                    </Text>
                  </div>
                  <div className="flex items-center justify-end">
                    <StatusBadge color={color} className="text-nowrap">
                      {status}
                    </StatusBadge>
                  </div>
                  <div className="flex items-center justify-end">
                    <Text size="small" leading="compact">
                      {getLocaleAmount(p.amount, p.currency_code ?? order.currency_code)}
                    </Text>
                  </div>
                  <div />
                </div>
                {(p.refunds ?? []).map((refund) => (
                  <Refund key={refund.id} refund={refund} currencyCode={order.currency_code} />
                ))}
              </div>
            )
          })}
        </div>
      )}

      {(
        <div className="flex flex-col gap-y-4 px-6 py-4">
          <div className="flex items-center justify-between">
            <Text size="small" weight="plus" leading="compact">
              Total paid by customer
            </Text>
            <Text size="small" weight="plus" leading="compact">
              {getStylizedAmount(getTotalCaptured(order), order.currency_code)}
            </Text>
          </div>
          {order.status !== "canceled" && pending > 0 && (
            <div className="flex items-center justify-between">
              <Text size="small" weight="plus" leading="compact">
                Total pending
              </Text>
              <Text size="small" weight="plus" leading="compact">
                {getStylizedAmount(pending, order.currency_code)}
              </Text>
            </div>
          )}
        </div>
      )}
    </Container>
  )
}
