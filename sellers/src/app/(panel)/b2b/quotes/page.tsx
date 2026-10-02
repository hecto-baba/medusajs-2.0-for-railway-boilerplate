"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Badge,
  Button,
  Container,
  DropdownMenu,
  Heading,
  IconButton,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import {
  DocumentText,
  EllipsisHorizontal,
  Eye,
  CheckCircle,
  XCircle,
  ArrowLeft,
} from "@medusajs/icons"
import Link from "next/link"
import {
  listVendorQuotes,
  updateVendorQuoteStatus,
  VendorQuote,
} from "@lib/data/vendor-client"

const STATUS_TITLES: Record<string, string> = {
  accepted: "Accepted",
  customer_rejected: "Customer Rejected",
  merchant_rejected: "Merchant Rejected",
  pending_merchant: "Pending Merchant",
  pending_customer: "Pending Customer",
}

export default function QuotesPage() {
  const queryClient = useQueryClient()
  const [currentPage, setCurrentPage] = useState(0)
  const pageSize = 15

  // Fetch Quotes
  const { data, isLoading } = useQuery({
    queryKey: ["vendor-quotes", currentPage],
    queryFn: () =>
      listVendorQuotes({
        limit: pageSize,
        offset: currentPage * pageSize,
      }),
  })

  const quotes = data?.quotes || []
  const count = data?.count || 0

  // Update Status Mutation
  const statusMutation = useMutation({
    mutationFn: ({ quoteId, status }: { quoteId: string; status: string }) =>
      updateVendorQuoteStatus(quoteId, status),
    onSuccess: (_, variables) => {
      toast.success("Updated", {
        description: `Quote marked as ${STATUS_TITLES[variables.status] || variables.status}.`,
      })
      queryClient.invalidateQueries({ queryKey: ["vendor-quotes"] })
    },
    onError: (err: any) => {
      toast.error("Error", { description: err.message || "Failed to update quote" })
    },
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "accepted":
        return "green"
      case "customer_rejected":
      case "merchant_rejected":
        return "red"
      case "pending_customer":
        return "blue"
      default:
        return "orange"
    }
  }

  return (
    <div className="flex flex-col gap-y-6 max-w-7xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            href="/b2b"
            className="text-xs font-semibold text-ui-fg-subtle hover:text-ui-fg-base flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to B2B Overview
          </Link>
          <Heading level="h1" className="text-2xl font-bold flex items-center gap-2">
            <DocumentText className="w-6 h-6 text-ui-fg-base" />
            Wholesale Quotes
          </Heading>
          <Text size="small" className="text-ui-fg-subtle mt-0.5">
            Review custom wholesale price requests, negotiate volume discounts, and adjust delivery pricing.
          </Text>
        </div>
      </div>

      {/* Quotes Table */}
      <Container className="p-0 overflow-hidden divide-y divide-ui-border-base">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Quote ID</Table.HeaderCell>
              <Table.HeaderCell>Buyer / Company</Table.HeaderCell>
              <Table.HeaderCell>Total Amount</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Created Date</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {isLoading ? (
              <Table.Row>
                <td colSpan={6} className="text-center py-10 text-ui-fg-subtle">
                  Loading quotes...
                </td>
              </Table.Row>
            ) : quotes.length === 0 ? (
              <Table.Row>
                <td colSpan={6} className="text-center py-12">
                  <DocumentText className="w-8 h-8 text-ui-fg-muted mx-auto mb-2 opacity-50" />
                  <Text className="font-medium text-ui-fg-base">No quote requests yet</Text>
                  <Text size="small" className="text-ui-fg-subtle mt-1 max-w-sm mx-auto">
                    When B2B corporate buyers submit price inquiries or custom wholesale negotiations, they will appear here.
                  </Text>
                </td>
              </Table.Row>
            ) : (
              quotes.map((quote) => {
                const customer = quote.customer
                const companyName = customer?.employee?.company?.name
                const customerName = customer
                  ? `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || customer.email
                  : "Wholesale Buyer"
                const amount = quote.draft_order?.total ?? quote.cart?.total ?? 0
                const currency = quote.draft_order?.currency_code ?? quote.cart?.currency_code ?? "EUR"

                return (
                  <Table.Row key={quote.id} className="hover:bg-ui-bg-subtle/50 transition-colors">
                    <Table.Cell className="font-medium font-mono text-xs">
                      <Link href={`/b2b/quotes/${quote.id}`} className="hover:underline text-ui-fg-base font-semibold">
                        {quote.id.slice(0, 16)}...
                      </Link>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="font-medium text-ui-fg-base">{companyName || customerName}</div>
                      {companyName && (
                        <div className="text-xs text-ui-fg-subtle">Buyer: {customerName}</div>
                      )}
                    </Table.Cell>
                    <Table.Cell className="font-mono text-sm font-semibold">
                      {amount} {currency.toUpperCase()}
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color={getStatusColor(quote.status) as any} size="xsmall">
                        {STATUS_TITLES[quote.status] || quote.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell className="text-xs text-ui-fg-subtle">
                      {new Date(quote.created_at).toLocaleDateString()}
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/b2b/quotes/${quote.id}`}>
                          <Button size="small" variant="secondary" className="text-xs">
                            Negotiate &rarr;
                          </Button>
                        </Link>
                        <DropdownMenu>
                          <DropdownMenu.Trigger asChild>
                            <IconButton size="small" variant="transparent">
                              <EllipsisHorizontal />
                            </IconButton>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Content className="min-w-[150px]">
                            <DropdownMenu.Item
                              className="gap-x-2 text-emerald-600"
                              onClick={() =>
                                statusMutation.mutate({ quoteId: quote.id, status: "accepted" })
                              }
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span>Accept Quote</span>
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                              className="gap-x-2 text-rose-500"
                              onClick={() =>
                                statusMutation.mutate({ quoteId: quote.id, status: "merchant_rejected" })
                              }
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Reject Quote</span>
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                )
              })
            )}
          </Table.Body>
        </Table>
      </Container>
    </div>
  )
}
