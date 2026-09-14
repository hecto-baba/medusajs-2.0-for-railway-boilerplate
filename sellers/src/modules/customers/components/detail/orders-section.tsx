"use client"

import { type VendorCustomer } from "@lib/data/vendor-client"
import { Badge, Container, Heading, Table, Text } from "@medusajs/ui"
import Link from "next/link"

type OrdersSectionProps = {
  customer: VendorCustomer
}

export const OrdersSection = ({ customer }: OrdersSectionProps) => {
  const orders = customer.orders ?? []

  return (
    <Container className="p-0 overflow-hidden">
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <Heading level="h2">Orders</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Orders placed with your store by this customer.
          </Text>
        </div>
        <Badge size="small" color="purple">
          {orders.length} {orders.length === 1 ? "order" : "orders"}
        </Badge>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <Text size="small" className="text-ui-fg-subtle">
            No orders have been placed by this customer yet.
          </Text>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Order</Table.HeaderCell>
              <Table.HeaderCell>Date</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Total</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {orders.map((order: any) => {
              const displayTotal =
                typeof order.total === "number"
                  ? `${(order.total / 100).toFixed(2)} ${order.currency_code?.toUpperCase() ?? "USD"}`
                  : "-"

              return (
                <Table.Row key={order.id}>
                  <Table.Cell>
                    <Link
                      href={`/orders/${order.id}`}
                      className="text-ui-fg-interactive hover:underline font-mono text-xs"
                    >
                      #{order.id.slice(-6)}
                    </Link>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="small" className="text-ui-fg-subtle">
                      {new Date(order.created_at).toLocaleDateString()}
                    </Text>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <Text size="small" weight="plus">
                      {displayTotal}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              )
            })}
          </Table.Body>
        </Table>
      )}
    </Container>
  )
}
