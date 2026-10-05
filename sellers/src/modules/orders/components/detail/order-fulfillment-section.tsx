"use client"

import type { VendorFulfillment, VendorOrderDetail } from "@lib/data/vendor-client"
import { Buildings, XCircle } from "@medusajs/icons"
import { Button, Container, Copy, Heading, StatusBadge, Text, Tooltip } from "@medusajs/ui"
import { ActionMenu, Thumbnail } from "@modules/common"
import { num, type OrderActionsApi } from "./order-actions"
import { formatDateTime, getLocaleAmount } from "./order-format"

/**
 * Unfulfilled Items and per-fulfillment cards - ported from the admin's
 * OrderFulfillmentSection. The buttons call the seller order actions (pack,
 * ship, deliver, cancel), the same ones the old Fulfilment card used.
 */

type Item = NonNullable<VendorOrderDetail["items"]>[number]

const UnfulfilledItem = ({ item, left, currencyCode }: { item: Item; left: number; currencyCode: string }) => (
  <div className="text-ui-fg-subtle grid grid-cols-2 items-start px-6 py-4">
    <div className="flex items-start gap-x-4">
      <Thumbnail src={item.thumbnail} />
      <div>
        <Text size="small" leading="compact" weight="plus" className="text-ui-fg-base">
          {item.title}
        </Text>
        {item.variant_sku && (
          <div className="flex items-center gap-x-1">
            <Text size="small">{item.variant_sku}</Text>
            <Copy content={item.variant_sku} className="text-ui-fg-muted" />
          </div>
        )}
        <Text size="small">
          {item.variant?.options?.map((o) => o.value).join(" · ") || item.variant_title}
        </Text>
      </div>
    </div>
    <div className="grid grid-cols-3 items-center gap-x-4">
      <div className="flex items-center justify-end">
        <Text size="small">{getLocaleAmount(item.unit_price, currencyCode)}</Text>
      </div>
      <div className="flex items-center justify-end">
        <Text>
          <span className="tabular-nums">{left}</span>x
        </Text>
      </div>
      <div className="flex items-center justify-end">
        <Text size="small">{getLocaleAmount(item.subtotal ?? item.unit_price * item.quantity, currencyCode)}</Text>
      </div>
    </div>
  </div>
)

const UnfulfilledItems = ({
  order,
  actions,
}: {
  order: VendorOrderDetail
  actions: OrderActionsApi
}) => {
  const { unfulfilled } = actions
  if (!unfulfilled.length || actions.canceled) return null

  const groups = [
    { requiresShipping: true, rows: unfulfilled.filter((r) => r.item.requires_shipping !== false) },
    { requiresShipping: false, rows: unfulfilled.filter((r) => r.item.requires_shipping === false) },
  ].filter((g) => g.rows.length)

  return (
    <>
      {groups.map((group) => (
        <Container key={String(group.requiresShipping)} className="divide-y p-0">
          <div className="flex items-center justify-between px-6 py-4">
            <Heading level="h2">Unfulfilled Items</Heading>
            <div className="flex items-center gap-x-4">
              {group.requiresShipping && (
                <StatusBadge color="red" className="text-nowrap">
                  Requires shipping
                </StatusBadge>
              )}
              <StatusBadge color="red" className="text-nowrap">
                Awaiting fulfillment
              </StatusBadge>
              <ActionMenu
                groups={[
                  {
                    actions: [
                      { label: "Fulfill items", icon: <Buildings />, onClick: actions.openFulfil },
                    ],
                  },
                ]}
              />
            </div>
          </div>
          <div>
            {group.rows.map(({ item, left }) => (
              <UnfulfilledItem key={item.id} item={item} left={left} currencyCode={order.currency_code} />
            ))}
          </div>
        </Container>
      ))}
    </>
  )
}

const Fulfillment = ({
  fulfillment,
  index,
  actions,
}: {
  fulfillment: VendorFulfillment
  index: number
  actions: OrderActionsApi
}) => {
  let statusText = "Awaiting shipping"
  let statusColor: "blue" | "green" | "red" = "blue"
  let statusTimestamp = fulfillment.created_at

  if (fulfillment.canceled_at) {
    statusText = "Canceled"
    statusColor = "red"
    statusTimestamp = fulfillment.canceled_at
  } else if (fulfillment.delivered_at) {
    statusText = "Delivered"
    statusColor = "green"
    statusTimestamp = fulfillment.delivered_at
  } else if (fulfillment.shipped_at) {
    statusText = "Shipped"
    statusColor = "green"
    statusTimestamp = fulfillment.shipped_at
  }

  const showShipping = !fulfillment.canceled_at && !fulfillment.shipped_at && !fulfillment.delivered_at
  const showDelivery = !fulfillment.canceled_at && !fulfillment.delivered_at
  const isUrl = (url?: string | null) => !!url && /^https?:\/\//i.test(url)

  const badge = (
    <StatusBadge color={statusColor} className="text-nowrap">
      {statusText}
    </StatusBadge>
  )

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Fulfillment #{index + 1}</Heading>
        <div className="flex items-center gap-x-4">
          {statusTimestamp ? <Tooltip content={formatDateTime(statusTimestamp)}>{badge}</Tooltip> : badge}
          <ActionMenu
            groups={[
              {
                actions: [
                  {
                    label: "Cancel",
                    icon: <XCircle />,
                    onClick: () => actions.cancelFulfilment(fulfillment.id),
                    disabled: actions.busy || !!fulfillment.canceled_at || !!fulfillment.shipped_at || !!fulfillment.delivered_at,
                  },
                ],
              },
            ]}
          />
        </div>
      </div>

      <div className="text-ui-fg-subtle grid grid-cols-2 items-start px-6 py-4">
        <Text size="small" leading="compact" weight="plus">
          Items
        </Text>
        <ul>
          {(fulfillment.items ?? []).map((item, i) => (
            <li key={`${item.line_item_id}-${i}`}>
              <Text size="small" leading="compact">
                {num(item.quantity)}x {item.title ?? "Item"}
              </Text>
            </li>
          ))}
        </ul>
      </div>

      <div className="text-ui-fg-subtle grid grid-cols-2 items-center px-6 py-4">
        <Text size="small" leading="compact" weight="plus">
          Provider
        </Text>
        <Text size="small" leading="compact">
          {fulfillment.provider_id ? fulfillment.provider_id.replace(/^manual_/, "").replace(/_/g, " ") : "-"}
        </Text>
      </div>

      <div className="text-ui-fg-subtle grid grid-cols-2 items-start px-6 py-4">
        <Text size="small" leading="compact" weight="plus">
          Tracking
        </Text>
        <div>
          {fulfillment.labels && fulfillment.labels.length > 0 ? (
            <ul>
              {fulfillment.labels.map((label) => (
                <li key={label.tracking_number}>
                  {isUrl(label.tracking_url) ? (
                    <a
                      href={label.tracking_url as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover transition-fg"
                    >
                      <Text size="small" leading="compact" as="span">
                        {label.tracking_number}
                      </Text>
                    </a>
                  ) : (
                    <Text size="small" leading="compact">
                      {label.tracking_number}
                    </Text>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Text size="small" leading="compact">
              -
            </Text>
          )}
        </div>
      </div>

      {(showShipping || showDelivery) && (
        <div className="bg-ui-bg-subtle flex items-center justify-end gap-x-2 rounded-b-xl px-4 py-4">
          {showDelivery && (
            <Button variant="secondary" disabled={actions.busy} onClick={() => actions.markDelivered(fulfillment.id)}>
              Mark as delivered
            </Button>
          )}
          {showShipping && (
            <Button variant="secondary" disabled={actions.busy} onClick={() => actions.openShip(fulfillment.id)}>
              Mark as shipped
            </Button>
          )}
        </div>
      )}
    </Container>
  )
}

export const OrderFulfillmentSection = ({
  order,
  actions,
}: {
  order: VendorOrderDetail
  actions: OrderActionsApi
}) => (
  <div className="flex flex-col gap-y-3">
    <UnfulfilledItems order={order} actions={actions} />
    {(order.fulfillments ?? []).map((f, index) => (
      <Fulfillment key={f.id} fulfillment={f} index={index} actions={actions} />
    ))}
  </div>
)
