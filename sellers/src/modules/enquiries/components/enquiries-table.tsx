"use client"

import {
  listVendorEnquiries,
  type VendorEnquiryStatus,
} from "@lib/data/vendor-client"
import {
  Badge,
  Button,
  Container,
  Heading,
  Select,
  Table,
  Text,
} from "@medusajs/ui"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import {
  ENQUIRY_STATUS_COLOR,
  ENQUIRY_STATUS_LABEL,
  EnquiryReplyDrawer,
  formatEnquiryDate,
} from "./enquiry-reply-drawer"

const PAGE_SIZE = 20

type StatusFilter = VendorEnquiryStatus | "all"

/**
 * Every enquiry on any of the seller's products, newest first. The backend
 * scopes the list to the calling seller's own products, so nothing here
 * filters by seller.
 */
export const EnquiriesTable = () => {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<StatusFilter>("all")
  const [page, setPage] = useState(0)
  const [activeId, setActiveId] = useState<string | null>(null)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["vendor-enquiries", status, page],
    queryFn: () =>
      listVendorEnquiries({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        status: status === "all" ? undefined : status,
      }),
    retry: false,
  })

  const enquiries = data?.enquiries ?? []
  const count = data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE))

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["vendor-enquiries"] })
    // The product page lists the same enquiries under its own key.
    queryClient.invalidateQueries({ queryKey: ["vendor-product-enquiries"] })
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h1">Enquiries</Heading>
        <Select
          size="small"
          value={status}
          onValueChange={(value) => {
            setStatus(value as StatusFilter)
            setPage(0)
          }}
        >
          <Select.Trigger className="w-40">
            <Select.Value placeholder="Status" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="all">All statuses</Select.Item>
            <Select.Item value="pending">Pending</Select.Item>
            <Select.Item value="responded">Responded</Select.Item>
            <Select.Item value="closed">Closed</Select.Item>
          </Select.Content>
        </Select>
      </div>

      {isLoading && (
        <div className="px-6 py-4">
          <Text className="text-ui-fg-subtle">Loading...</Text>
        </div>
      )}

      {isError && (
        <div className="px-6 py-4">
          <Text className="text-ui-fg-error">
            {error instanceof Error ? error.message : "Could not load enquiries."}
          </Text>
        </div>
      )}

      {!isLoading && !isError && enquiries.length === 0 && (
        <div className="px-6 py-8">
          <Text className="text-ui-fg-subtle">
            {status === "all"
              ? "No enquiries yet. They appear here when customers ask about a product that has enquiries turned on."
              : "No enquiries with this status."}
          </Text>
        </div>
      )}

      {enquiries.length > 0 && (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Product</Table.HeaderCell>
              <Table.HeaderCell>Customer</Table.HeaderCell>
              <Table.HeaderCell>Message</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Date</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {enquiries.map((enquiry) => (
              <Table.Row
                key={enquiry.id}
                className="cursor-pointer"
                onClick={() => setActiveId(enquiry.id)}
              >
                <Table.Cell>{enquiry.product?.title ?? "-"}</Table.Cell>
                <Table.Cell>{enquiry.customer_email}</Table.Cell>
                <Table.Cell className="max-w-xs truncate">{enquiry.message}</Table.Cell>
                <Table.Cell>
                  <Badge size="2xsmall" color={ENQUIRY_STATUS_COLOR[enquiry.status]}>
                    {ENQUIRY_STATUS_LABEL[enquiry.status]}
                  </Badge>
                </Table.Cell>
                <Table.Cell>{formatEnquiryDate(enquiry.created_at)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}

      {count > PAGE_SIZE && (
        <div className="flex items-center justify-between px-6 py-3">
          <Text size="small" className="text-ui-fg-subtle">
            Page {page + 1} of {pageCount} · {count} enquiries
          </Text>
          <div className="flex gap-x-2">
            <Button
              size="small"
              variant="secondary"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <Button
              size="small"
              variant="secondary"
              disabled={page + 1 >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <EnquiryReplyDrawer
        enquiryId={activeId}
        onClose={() => setActiveId(null)}
        onChanged={refresh}
      />
    </Container>
  )
}
