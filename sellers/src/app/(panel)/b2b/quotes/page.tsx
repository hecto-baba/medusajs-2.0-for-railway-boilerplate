"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Badge,
  Button,
  Container,
  DropdownMenu,
  FocusModal,
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
  const [selectedQuote, setSelectedQuote] = useState<VendorQuote | null>(null)
  const pageSize = 20

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
  const { mutateAsync: updateQuoteStatus, isPending } = useMutation({
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
    <Container className="p-0 divide-y">
      <div className="flex items-center justify-between p-6">
        <div>
          <Heading level="h2">Quotes</Heading>
          <Text className="text-ui-fg-subtle text-sm">
            Review custom wholesale price negotiations requested by B2B buyers.
          </Text>
        </div>
      </div>

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>ID</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell>Email</Table.HeaderCell>
            <Table.HeaderCell>Customer Name</Table.HeaderCell>
            <Table.HeaderCell>Total</Table.HeaderCell>
            <Table.HeaderCell>Created At</Table.HeaderCell>
            <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {quotes.length === 0 ? (
            <Table.Row>
              <td colSpan={7} className="py-12 text-center">
                <div className="flex flex-col items-center justify-center gap-y-2">
                  <DocumentText className="text-ui-fg-muted" />
                  <Text weight="plus">No quotes found</Text>
                  <Text size="small" className="text-ui-fg-subtle">
                    There are currently no active quote requests.
                  </Text>
                </div>
              </td>
            </Table.Row>
          ) : (
            quotes.map((quote) => {
              const customer = quote.customer || ({} as any)
              const customerName =
                [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "-"
              const email = customer.email || "-"
              const currency = (quote.cart?.currency_code || "eur").toUpperCase()
              const total = quote.cart?.total
                ? `${Number(quote.cart.total).toFixed(2)} ${currency}`
                : "-"
              const createdAt = quote.created_at
                ? new Date(quote.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "-"

              const statusTitle = STATUS_TITLES[quote.status] || quote.status

              return (
                <Table.Row key={quote.id}>
                  <Table.Cell
                    className="font-mono text-xs font-semibold cursor-pointer text-ui-fg-interactive hover:underline"
                    onClick={() => window.location.href = `/b2b/quotes/${quote.id}`}
                  >
                    {quote.id.replace("quote_", "#")}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={getStatusColor(quote.status) as any} size="xsmall">
                      {statusTitle}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell className="text-ui-fg-subtle">{email}</Table.Cell>
                  <Table.Cell className="font-medium">{customerName}</Table.Cell>
                  <Table.Cell className="font-semibold">{total}</Table.Cell>
                  <Table.Cell className="text-ui-fg-subtle text-xs">{createdAt}</Table.Cell>
                  <Table.Cell className="text-right">
                    <DropdownMenu>
                      <DropdownMenu.Trigger asChild>
                        <IconButton size="small" variant="transparent">
                          <EllipsisHorizontal />
                        </IconButton>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Content className="min-w-[180px]">
                        <DropdownMenu.Item asChild className="gap-x-2">
                          <Link href={`/b2b/quotes/${quote.id}`}>
                            <Eye className="text-ui-fg-subtle" />
                            <span>View Quote Details</span>
                          </Link>
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          className="gap-x-2"
                          onClick={() => setSelectedQuote(quote)}
                        >
                          <DocumentText className="text-ui-fg-subtle" />
                          <span>Quick Review Items</span>
                        </DropdownMenu.Item>
                        {quote.status === "pending_merchant" && (
                          <>
                            <DropdownMenu.Separator />
                            <DropdownMenu.Item
                              className="gap-x-2 text-ui-fg-interactive"
                              onClick={() =>
                                updateQuoteStatus({
                                  quoteId: quote.id,
                                  status: "accepted",
                                })
                              }
                            >
                              <CheckCircle className="text-ui-fg-interactive" />
                              <span>Accept quote</span>
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                              className="gap-x-2 text-ui-fg-error"
                              onClick={() =>
                                updateQuoteStatus({
                                  quoteId: quote.id,
                                  status: "merchant_rejected",
                                })
                              }
                            >
                              <XCircle className="text-ui-fg-error" />
                              <span>Reject quote</span>
                            </DropdownMenu.Item>
                          </>
                        )}
                      </DropdownMenu.Content>
                    </DropdownMenu>
                  </Table.Cell>
                </Table.Row>
              )
            })
          )}
        </Table.Body>
      </Table>

      {/* Review Quote Items Modal */}
      {selectedQuote && (
        <FocusModal
          open={Boolean(selectedQuote)}
          onOpenChange={(open) => !open && setSelectedQuote(null)}
        >
          <FocusModal.Content className="max-w-2xl mx-auto my-auto rounded-lg border bg-ui-bg-base p-6 shadow-elevation-modal">
            <FocusModal.Header className="pb-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <Heading level="h2">
                    Quote {selectedQuote.id.replace("quote_", "#")}
                  </Heading>
                  <Text className="text-ui-fg-subtle text-sm">
                    Buyer: {selectedQuote.customer?.email || selectedQuote.customer_id}
                  </Text>
                </div>
                <Badge color={getStatusColor(selectedQuote.status) as any} size="small">
                  {STATUS_TITLES[selectedQuote.status] || selectedQuote.status}
                </Badge>
              </div>
            </FocusModal.Header>

            <FocusModal.Body className="py-6 flex flex-col gap-y-4">
              <Heading level="h3" className="text-base">
                Line Items
              </Heading>
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Item</Table.HeaderCell>
                    <Table.HeaderCell>Quantity</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Unit Price</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {(selectedQuote.cart?.items || []).length === 0 ? (
                    <Table.Row>
                      <td colSpan={3} className="text-center py-4 text-ui-fg-subtle">
                        No line item details found for this cart.
                      </td>
                    </Table.Row>
                  ) : (
                    selectedQuote.cart!.items!.map((item: any) => (
                      <Table.Row key={item.id}>
                        <Table.Cell className="font-medium">{item.title}</Table.Cell>
                        <Table.Cell>{item.quantity}</Table.Cell>
                        <Table.Cell className="text-right font-medium">
                          {item.unit_price}{" "}
                          {(selectedQuote.cart?.currency_code || "EUR").toUpperCase()}
                        </Table.Cell>
                      </Table.Row>
                    ))
                  )}
                </Table.Body>
              </Table>

              <div className="flex justify-end pt-2 border-t text-sm">
                <div className="w-48 space-y-1">
                  <div className="flex justify-between text-ui-fg-subtle">
                    <span>Subtotal</span>
                    <span>
                      {selectedQuote.cart?.subtotal || selectedQuote.cart?.total || 0}{" "}
                      {(selectedQuote.cart?.currency_code || "EUR").toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold text-base">
                    <span>Total</span>
                    <span>
                      {selectedQuote.cart?.total || 0}{" "}
                      {(selectedQuote.cart?.currency_code || "EUR").toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            </FocusModal.Body>

            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="secondary"
                size="small"
                onClick={() => setSelectedQuote(null)}
              >
                Close
              </Button>
              {selectedQuote.status === "pending_merchant" && (
                <div className="flex items-center gap-x-2">
                  <Button
                    variant="danger"
                    size="small"
                    onClick={async () => {
                      await updateQuoteStatus({
                        quoteId: selectedQuote.id,
                        status: "merchant_rejected",
                      })
                      setSelectedQuote(null)
                    }}
                    isLoading={isPending}
                  >
                    Reject Quote
                  </Button>
                  <Button
                    size="small"
                    onClick={async () => {
                      await updateQuoteStatus({
                        quoteId: selectedQuote.id,
                        status: "accepted",
                      })
                      setSelectedQuote(null)
                    }}
                    isLoading={isPending}
                  >
                    Accept Quote
                  </Button>
                </div>
              )}
            </div>
          </FocusModal.Content>
        </FocusModal>
      )}
    </Container>
  )
}
