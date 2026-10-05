"use client"

import type { VendorOrderDetail } from "@lib/data/vendor-client"
import { XCircle } from "@medusajs/icons"
import { Container, Copy, Heading, StatusBadge, Text } from "@medusajs/ui"
import { ActionMenu } from "@modules/common"
import type { OrderActionsApi } from "./order-actions"
import {
  getFullDate,
  getOrderFulfillmentStatus,
  getOrderPaymentStatus,
} from "./order-format"

/**
 * The order header card - ported from the admin's OrderGeneralSection: the
 * #id with copy, "on <date> from <sales channel>", and the three status
 * badges, and the "..." menu with Cancel.
 *
 * On an older order shared with other sellers the payment and fulfillment
 * badges are left out, as they describe the whole order.
 */
export const OrderGeneralSection = ({
  order,
  actions,
}: {
  order: VendorOrderDetail
  actions: OrderActionsApi
}) => {
  const canceled = order.status === "canceled" || order.status === "cancelled"
  const payment = getOrderPaymentStatus(order)
  const fulfillment = getOrderFulfillmentStatus(order)

  return (
    <Container className="flex items-center justify-between px-6 py-4">
      <div>
        <div className="flex items-center gap-x-1">
          <Heading>#{order.display_id}</Heading>
          <Copy content={`#${order.display_id}`} className="text-ui-fg-muted" />
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          {getFullDate(order.created_at, true)}
          {order.sales_channel?.name ? ` from ${order.sales_channel.name}` : ""}
        </Text>
      </div>
      <div className="flex items-center gap-x-4">
      <div className="flex items-center gap-x-1.5">
        {canceled && (
          <StatusBadge color="red" className="text-nowrap">
            Canceled
          </StatusBadge>
        )}
        {!order.is_mixed && (
          <>
            <StatusBadge color={payment.color} className="text-nowrap">
              {payment.label}
            </StatusBadge>
            <StatusBadge color={fulfillment.color} className="text-nowrap">
              {fulfillment.label}
            </StatusBadge>
          </>
        )}
      </div>
        {!order.is_mixed && (
          <ActionMenu
            groups={[
              {
                actions: [
                  {
                    label: "Cancel",
                    onClick: actions.cancelOrder,
                    disabled: canceled || actions.busy,
                    icon: <XCircle />,
                  },
                ],
              },
            ]}
          />
        )}
      </div>
    </Container>
  )
}
