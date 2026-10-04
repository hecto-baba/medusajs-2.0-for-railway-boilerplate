"use client"

import { getVendorOrder } from "@lib/data/vendor-client"
import {
  Container,
  Heading,
  StatusBadge,
  Table,
  Text,
} from "@medusajs/ui"
import { ArrowLeft, Buildings, CreditCard, User } from "@medusajs/icons"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { OrderActions } from "./order-actions"
import { OrderRentalsSection } from "./order-rentals-section"

type OrderDetailProps = {
  id: string
}

const ORDER_STATUS_COLOR: Record<string, "green" | "grey" | "red" | "orange"> = {
  completed: "green",
  pending: "orange",
  canceled: "red",
  cancelled: "red",
  requires_action: "orange",
}

/**
 * A vendor's own view of a single order.
 *
 * Mirrors DraftOrderDetail's layout (back link, header container, items +
 * summary grid alongside customer/address cards) so it lines up visually
 * with the rest of the panel, then adds the rentals section beneath - the
 * vendor equivalent of the admin's order-detail-page rental widget, which
 * previously had nowhere to render in this app since no order-detail route
 * existed at all.
 */
export const OrderDetail = ({ id }: OrderDetailProps) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["vendor-order", id],
    queryFn: () => getVendorOrder(id),
  })

  const order = data?.order

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Text className="text-ui-fg-muted">Loading order details...</Text>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center gap-y-4 p-16">
        <Text className="text-ui-fg-error">Order not found or access denied.</Text>
        <Link
          href="/orders"
          className="text-ui-fg-subtle hover:text-ui-fg-base inline-flex items-center gap-x-2 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Orders</span>
        </Link>
      </div>
    )
  }

  const items = order.items || []
  const currency = (order.currency_code || "USD").toUpperCase()
  const shipping = order.shipping_address as any
  const billing = order.billing_address as any

  return (
    <div className="flex flex-col gap-y-6 p-8 max-w-7xl mx-auto">
      <div>
        <Link
          href="/orders"
          className="text-ui-fg-subtle hover:text-ui-fg-base inline-flex items-center gap-x-2 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Orders</span>
        </Link>
      </div>

      {order.is_mixed && (
        <Container className="p-4" data-testid="legacy-shared-order-note">
          <Text size="small" className="text-ui-fg-subtle">
            This is an older order that also contained other sellers&apos; items. You see only your own
            items; payment, shipping and the whole-order totals are not shown here.
          </Text>
        </Container>
      )}

      <Container className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-y-2">
            <div className="flex items-center gap-x-3">
              <Heading level="h1">Order #{order.display_id}</Heading>
              <StatusBadge color={ORDER_STATUS_COLOR[order.status] ?? "grey"}>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </StatusBadge>
            </div>
            <Text size="small" className="text-ui-fg-muted">
              Placed on{" "}
              {new Date(order.created_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </div>
        </div>
      </Container>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-y-6">
          <Container className="p-6 flex flex-col gap-y-4">
            <Heading level="h2">Items</Heading>
            <Text size="small" className="text-ui-fg-muted -mt-2">
              Only your own products are shown; other vendors&apos; items on this
              order are not visible here.
            </Text>
            <div className="border border-ui-border-base rounded-lg overflow-hidden">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Item</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Qty</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Unit Price</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Total</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {items.map((it) => (
                    <Table.Row key={it.id}>
                      <Table.Cell>
                        <div className="flex flex-col">
                          <Text size="small" weight="plus">
                            {it.title}
                          </Text>
                          {it.variant_title && (
                            <Text size="xsmall" className="text-ui-fg-muted">
                              {it.variant_title}
                            </Text>
                          )}
                        </div>
                      </Table.Cell>
                      <Table.Cell className="text-right font-mono text-sm">
                        {it.quantity}
                      </Table.Cell>
                      <Table.Cell className="text-right font-mono text-sm">
                        {currency} {(it.unit_price ?? 0).toFixed(2)}
                      </Table.Cell>
                      <Table.Cell className="text-right font-mono font-medium text-sm">
                        {currency} {((it.quantity ?? 1) * (it.unit_price ?? 0)).toFixed(2)}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          </Container>

          <OrderActions order={order} />

          <Container className="p-6 flex flex-col gap-y-3">
            <Heading level="h2">Order Summary</Heading>
            <Text size="small" className="text-ui-fg-muted -mt-2">
              Reflects only your share of this order.
            </Text>
            <div className="flex flex-col gap-y-2 text-sm border-t border-ui-border-base pt-3">
              <div className="flex justify-between">
                <Text className="text-ui-fg-subtle">Subtotal</Text>
                <Text className="font-mono">
                  {currency} {(order.subtotal ?? order.total ?? 0).toFixed(2)}
                </Text>
              </div>
              <div className="flex justify-between border-t border-ui-border-base pt-2 font-bold text-base">
                <Text weight="plus">Total</Text>
                <Text weight="plus" className="font-mono">
                  {currency} {(order.total ?? 0).toFixed(2)}
                </Text>
              </div>
            </div>
          </Container>

          <OrderRentalsSection orderId={id} />
        </div>

        <div className="flex flex-col gap-y-6">
          <Container className="p-6 flex flex-col gap-y-3">
            <div className="flex items-center gap-x-2">
              <User className="text-ui-fg-muted h-5 w-5" />
              <Heading level="h2">Customer</Heading>
            </div>
            <div className="flex flex-col gap-y-1 text-sm border-t border-ui-border-base pt-3">
              <Text weight="plus">
                {[order.customer?.first_name, order.customer?.last_name]
                  .filter(Boolean)
                  .join(" ") || "Guest"}
              </Text>
              <Text className="text-ui-fg-subtle">
                {order.customer?.email || order.email || "No email"}
              </Text>
            </div>
          </Container>

          <Container className="p-6 flex flex-col gap-y-3">
            <div className="flex items-center gap-x-2">
              <Buildings className="text-ui-fg-muted h-5 w-5" />
              <Heading level="h2">Shipping Address</Heading>
            </div>
            <div className="flex flex-col gap-y-1 text-sm border-t border-ui-border-base pt-3 text-ui-fg-subtle">
              {shipping ? (
                <>
                  <Text weight="plus" className="text-ui-fg-base">
                    {[shipping.first_name, shipping.last_name].filter(Boolean).join(" ")}
                  </Text>
                  {shipping.address_1 && <Text>{shipping.address_1}</Text>}
                  {[shipping.city, shipping.postal_code].some(Boolean) && (
                    <Text>
                      {[shipping.city, shipping.postal_code].filter(Boolean).join(" ")}
                    </Text>
                  )}
                  {shipping.country_code && (
                    <Text className="uppercase">{shipping.country_code}</Text>
                  )}
                  {/* Tickets, appointments, digital, EOI and pickup rentals are
                      ordered with contact details only, so a missing street is
                      expected here, not an error. */}
                  {!shipping.address_1 && (
                    <Text className="text-ui-fg-muted">
                      No delivery address - nothing to ship
                    </Text>
                  )}
                </>
              ) : (
                <Text className="text-ui-fg-muted">No shipping address</Text>
              )}
            </div>
          </Container>

          <Container className="p-6 flex flex-col gap-y-3">
            <div className="flex items-center gap-x-2">
              <CreditCard className="text-ui-fg-muted h-5 w-5" />
              <Heading level="h2">Billing Address</Heading>
            </div>
            <div className="flex flex-col gap-y-1 text-sm border-t border-ui-border-base pt-3 text-ui-fg-subtle">
              {billing ? (
                <>
                  <Text weight="plus" className="text-ui-fg-base">
                    {[billing.first_name, billing.last_name].filter(Boolean).join(" ")}
                  </Text>
                  {billing.address_1 && <Text>{billing.address_1}</Text>}
                  {[billing.city, billing.postal_code].some(Boolean) && (
                    <Text>
                      {[billing.city, billing.postal_code].filter(Boolean).join(" ")}
                    </Text>
                  )}
                  {billing.country_code && (
                    <Text className="uppercase">{billing.country_code}</Text>
                  )}
                </>
              ) : (
                <Text className="text-ui-fg-muted">Same as shipping address</Text>
              )}
            </div>
          </Container>
        </div>
      </div>
    </div>
  )
}
