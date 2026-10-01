"use client"

import { listVendorPayouts, type VendorPayoutEntry } from "@lib/data/vendor-client"
import { Button, Container, Heading, Select, StatusBadge, Table, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useState } from "react"

const PAGE_SIZE = 50
const STATUS_COLOR = { owed: "orange", paid: "green", void: "grey" } as const
const STATUS_LABEL = { owed: "To be paid", paid: "Paid", void: "Void" } as const

const money = (value: unknown, currency: string) =>
  `${Number(value ?? 0).toFixed(2)} ${currency.toUpperCase()}`

/**
 * What the platform owes the seller for their orders, after refunds. The buyer pays
 * the platform once and the platform pays sellers out, so each order of the seller's
 * has an entry here: owed until the platform has paid it, then paid (with its
 * reference), or void if the order was cancelled.
 */
export const EarningsTable = () => {
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(0)

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-payouts", status, page],
    queryFn: () =>
      listVendorPayouts({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        payout_status: status === "all" ? undefined : (status as VendorPayoutEntry["payout_status"]),
      }),
  })

  const payouts = data?.payouts ?? []
  const pages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-y-6 p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h1">Earnings</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            What you are owed for your orders, after refunds.
          </Text>
        </div>
        <div className="w-44">
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value)
              setPage(0)
            }}
          >
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">All</Select.Item>
              <Select.Item value="owed">To be paid</Select.Item>
              <Select.Item value="paid">Paid</Select.Item>
              <Select.Item value="void">Void</Select.Item>
            </Select.Content>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3" data-testid="earnings-totals">
        {Object.entries(data?.totals ?? {}).map(([currency, sums]) => (
          <Container key={currency} className="p-6 flex flex-col gap-y-1">
            <Text size="xsmall" className="text-ui-fg-muted uppercase">
              {currency}
            </Text>
            <Heading level="h2">{money(sums.owed - sums.refunded, currency)}</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              to be paid · {money(sums.paid, currency)} paid · {money(sums.refunded, currency)} refunded
            </Text>
          </Container>
        ))}
      </div>

      <Container className="divide-y p-0">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Date</Table.HeaderCell>
              <Table.HeaderCell>Order</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Items</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Shipping</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Tax</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Refunded</Table.HeaderCell>
              <Table.HeaderCell className="text-right">You are owed</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Reference</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {payouts.map((entry) => (
              <Table.Row key={entry.id}>
                <Table.Cell>{new Date(entry.created_at).toLocaleDateString()}</Table.Cell>
                <Table.Cell>
                  <Link href={`/orders/${entry.child_order_id}`} className="text-ui-fg-interactive">
                    View order
                  </Link>
                </Table.Cell>
                <Table.Cell className="text-right">{money(entry.items_total, entry.currency_code)}</Table.Cell>
                <Table.Cell className="text-right">{money(entry.shipping_total, entry.currency_code)}</Table.Cell>
                <Table.Cell className="text-right">{money(entry.tax_total, entry.currency_code)}</Table.Cell>
                <Table.Cell className="text-right">{money(entry.refunded_total, entry.currency_code)}</Table.Cell>
                <Table.Cell className="text-right font-medium">
                  {money(Number(entry.total) - Number(entry.refunded_total ?? 0), entry.currency_code)}
                </Table.Cell>
                <Table.Cell>
                  <StatusBadge color={STATUS_COLOR[entry.payout_status]}>{STATUS_LABEL[entry.payout_status]}</StatusBadge>
                </Table.Cell>
                <Table.Cell>{entry.payout_reference ?? "-"}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>

        {!isLoading && payouts.length === 0 && (
          <div className="px-6 py-10 text-center">
            <Text size="small" className="text-ui-fg-subtle">
              No earnings yet. They appear here when an order that includes your products is placed.
            </Text>
          </div>
        )}

        <div className="flex items-center justify-between px-6 py-3">
          <Text size="small" className="text-ui-fg-subtle">
            Page {page + 1} of {pages}
          </Text>
          <div className="flex gap-x-2">
            <Button size="small" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button size="small" variant="secondary" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      </Container>
    </div>
  )
}
