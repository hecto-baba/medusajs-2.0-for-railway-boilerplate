"use client"

import type { VendorOrderDetail } from "@lib/data/vendor-client"
import { ArrowUturnLeft, CurrencyDollar, ReceiptPercent, TriangleDownMini } from "@medusajs/icons"
import { Container, Copy, Heading, Text, Tooltip, clx } from "@medusajs/ui"
import { ActionMenu, Thumbnail } from "@modules/common"
import type { OrderActionsApi } from "./order-actions"
import { useState, type ReactNode } from "react"
import {
  getLocaleAmount,
  getStylizedAmount,
  getTotalCaptured,
} from "./order-format"

/**
 * The Summary card - ported from the admin's OrderSummarySection: each line
 * item, then item subtotal / shipping / tax / total, discounts, and finally
 * paid total and outstanding amount. The header menu offers the seller's
 * refund and return; the admin's edit order, claim, exchange and mark-as-paid
 * have no seller route and are left out.
 *
 * Whole-order figures are null on an older order shared with other sellers, so
 * those rows are left out there rather than shown as 0.
 */

const Cost = ({
  label,
  value,
  bold,
}: {
  label: ReactNode
  value: string
  bold?: boolean
}) => (
  <div className="grid grid-cols-3 items-center">
    <Text as="div" size="small" leading="compact">
      {label}
    </Text>
    <div />
    <div className="text-right">
      <Text size="small" leading="compact" className={bold ? "font-medium" : undefined}>
        {value}
      </Text>
    </div>
  </div>
)

const Item = ({
  item,
  currencyCode,
}: {
  item: NonNullable<VendorOrderDetail["items"]>[number]
  currencyCode: string
}) => {
  const codes = (item.adjustments ?? []).map((a) => a.code).filter(Boolean) as string[]
  const options = item.variant?.options?.map((o) => o.value).join(" · ")

  return (
    <div className="text-ui-fg-subtle grid grid-cols-2 items-center gap-x-4 px-6 py-4">
      <div className="flex justify-between gap-x-2">
        <div className="group flex items-start gap-x-4">
          <Thumbnail src={item.thumbnail} />
          <div>
            <Text size="small" leading="compact" className="text-ui-fg-base">
              {item.title}
            </Text>
            {item.variant_sku && (
              <div className="flex items-center gap-x-1">
                <Text size="small">{item.variant_sku}</Text>
                <Copy content={item.variant_sku} className="text-ui-fg-muted hidden group-hover:block" />
              </div>
            )}
            <Text size="small">{options || item.variant_title}</Text>
          </div>
        </div>
        {codes.length > 0 && (
          <Tooltip
            content={
              <span className="text-pretty">
                {codes.map((code) => (
                  <div key={code}>{code}</div>
                ))}
              </span>
            }
          >
            <ReceiptPercent className="text-ui-fg-subtle flex-shrink self-center" />
          </Tooltip>
        )}
      </div>

      <div className="grid grid-cols-3 items-center gap-x-4">
        <div className="flex items-center justify-end gap-x-4">
          <Text size="small">{getLocaleAmount(item.unit_price, currencyCode)}</Text>
        </div>
        <div className="flex items-center gap-x-2">
          <div className="w-fit min-w-[27px]">
            <Text size="small">
              <span className="tabular-nums">{item.quantity}</span>x
            </Text>
          </div>
        </div>
        <div className="flex items-center justify-end">
          <Text size="small" className="pt-[1px]">
            {getLocaleAmount(item.subtotal ?? item.unit_price * item.quantity, currencyCode)}
          </Text>
        </div>
      </div>
    </div>
  )
}

const Toggle = ({
  label,
  open,
  onToggle,
  enabled = true,
}: {
  label: string
  open: boolean
  onToggle: () => void
  enabled?: boolean
}) => (
  <div
    onClick={() => enabled && onToggle()}
    className={clx("flex items-center gap-1", { "cursor-pointer": enabled })}
  >
    <span className="txt-small select-none">{label}</span>
    {enabled && (
      <TriangleDownMini style={{ transform: `rotate(${open ? 0 : -90}deg)` }} />
    )}
  </div>
)

const Breakdown = ({ rows }: { rows: { key: string; label: string; value: string }[] }) => (
  <div className="flex flex-col gap-1 pl-5">
    {rows.map((row) => (
      <div key={row.key} className="flex items-center justify-between gap-x-2">
        <span className="txt-small">{row.label}</span>
        <div className="relative flex-1">
          <div className="absolute h-[1px] w-full border-b border-dashed" />
        </div>
        <span className="txt-small text-ui-fg-muted">{row.value}</span>
      </div>
    ))}
  </div>
)

export const OrderSummarySection = ({
  order,
  actions,
}: {
  order: VendorOrderDetail
  actions: OrderActionsApi
}) => {
  const [shippingOpen, setShippingOpen] = useState(false)
  const [discountOpen, setDiscountOpen] = useState(false)

  const currency = order.currency_code
  const items = order.items ?? []
  const showTotals = !order.is_mixed

  const methods = order.shipping_methods ?? []
  const discountCodes = Array.from(
    new Set(items.flatMap((i) => (i.adjustments ?? []).map((a) => a.code)).filter(Boolean))
  ).sort() as string[]
  const hasDiscount = (order.item_discount_total ?? 0) > 0 || (order.shipping_discount_total ?? 0) > 0

  const paid = getTotalCaptured(order)
  const showPayments = showTotals

  return (
    <Container className="divide-y divide-dashed p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Summary</Heading>
        {showTotals && (
          <ActionMenu
            groups={[
              {
                actions: [
                  {
                    label: "Refund",
                    icon: <CurrencyDollar />,
                    onClick: actions.openRefund,
                    disabled: actions.canceled,
                  },
                  {
                    label: "Record a return",
                    icon: <ArrowUturnLeft />,
                    onClick: actions.openReturn,
                    disabled: actions.canceled,
                  },
                ],
              },
            ]}
          />
        )}
      </div>

      <div>
        {items.map((item) => (
          <Item key={item.id} item={item} currencyCode={currency} />
        ))}
      </div>

      {showTotals ? (
        <>
          <div className="text-ui-fg-subtle flex flex-col gap-y-2 px-6 py-4">
            <Cost
              label="Item Subtotal"
              value={getLocaleAmount(order.item_subtotal ?? order.subtotal, currency)}
            />
            <Cost
              label={
                <Toggle
                  label="Shipping Subtotal"
                  open={shippingOpen}
                  onToggle={() => setShippingOpen((o) => !o)}
                />
              }
              value={getLocaleAmount(order.shipping_subtotal ?? order.shipping_total, currency)}
            />
            {shippingOpen && (
              <Breakdown
                rows={methods.map((m: any) => ({
                  key: m.id ?? m.name,
                  label: m.name,
                  value: getLocaleAmount(m.subtotal ?? m.amount, currency),
                }))}
              />
            )}
            <Cost
              label="Tax Total"
              value={getLocaleAmount(order.original_tax_total ?? order.tax_total, currency)}
            />
            <Cost
              label="Order Total"
              bold
              value={getLocaleAmount(order.original_total ?? order.total, currency)}
            />
          </div>

          <div className="text-ui-fg-subtle flex flex-col gap-y-2 px-6 py-4">
            <Cost
              label={
                <Toggle
                  label="Discount Total"
                  open={discountOpen}
                  onToggle={() => setDiscountOpen((o) => !o)}
                  enabled={hasDiscount}
                />
              }
              value={getLocaleAmount(order.discount_total ?? 0, currency)}
            />
            {discountOpen && (
              <Breakdown
                rows={[
                  ...(order.item_discount_total
                    ? [
                        {
                          key: "item",
                          label: discountCodes.join(", ") || "Items",
                          value: getLocaleAmount(order.item_discount_total, currency),
                        },
                      ]
                    : []),
                  ...(order.shipping_discount_total
                    ? [
                        {
                          key: "shipping",
                          label: "Shipping",
                          value: getLocaleAmount(order.shipping_discount_total, currency),
                        },
                      ]
                    : []),
                ]}
              />
            )}
            <Cost label="Total After Discount" bold value={getLocaleAmount(order.total, currency)} />
          </div>

          {showPayments && (
            <div className="flex flex-col gap-y-2 px-6 py-4">
              <div className="flex items-center justify-between">
                <Text className="text-ui-fg-subtle" size="small" leading="compact">
                  Paid Total
                </Text>
                <Text className="text-ui-fg-subtle" size="small" leading="compact">
                  {getStylizedAmount(paid, currency)}
                </Text>
              </div>
              <div className="flex items-center justify-between">
                <Text className="text-ui-fg-subtle" size="small" leading="compact" weight="plus">
                  Outstanding amount
                </Text>
                <Text className="text-ui-fg-subtle" size="small" leading="compact" weight="plus">
                  {getStylizedAmount(order.summary?.pending_difference ?? 0, currency)}
                </Text>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="px-6 py-4">
          <Text size="small" className="text-ui-fg-subtle">
            This order also holds other sellers&apos; items, so only your items are listed. Shipping,
            tax, discount and payment figures cover the whole order and are not shown.
          </Text>
        </div>
      )}
    </Container>
  )
}
