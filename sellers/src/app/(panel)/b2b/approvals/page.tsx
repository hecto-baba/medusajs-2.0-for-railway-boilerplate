"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Badge,
  Button,
  Container,
  Heading,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import {
  CheckCircle,
  XCircle,
  ArrowLeft,
  User,
} from "@medusajs/icons"
import Link from "next/link"
import {
  listVendorApprovals,
  decideVendorApproval,
} from "@lib/data/vendor-client"

export default function ApprovalsPage() {
  const queryClient = useQueryClient()
  const [currentPage, setCurrentPage] = useState(0)
  const pageSize = 15

  // Fetch Approvals
  const { data, isLoading } = useQuery({
    queryKey: ["vendor-approvals", currentPage],
    queryFn: () =>
      listVendorApprovals({
        limit: pageSize,
        offset: currentPage * pageSize,
      }),
  })

  const approvals = data?.approvals || []
  const count = data?.count || 0

  // Decide Mutation
  const decideMutation = useMutation({
    mutationFn: ({ approvalId, status }: { approvalId: string; status: "approved" | "rejected" }) =>
      decideVendorApproval({ approval_id: approvalId, status }),
    onSuccess: (_, variables) => {
      toast.success("Success", {
        description: `Order spending request has been ${variables.status}.`,
      })
      queryClient.invalidateQueries({ queryKey: ["vendor-approvals"] })
    },
    onError: (err: any) => {
      toast.error("Error", { description: err.message || "Failed to update approval" })
    },
  })

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
            <CheckCircle className="w-6 h-6 text-ui-fg-base" />
            Corporate Spending Approvals
          </Heading>
          <Text size="small" className="text-ui-fg-subtle mt-0.5">
            Review purchase orders and corporate checkout requests that exceed employee spending thresholds.
          </Text>
        </div>
      </div>

      {/* Approvals Table */}
      <Container className="p-0 overflow-hidden divide-y divide-ui-border-base">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Approval ID</Table.HeaderCell>
              <Table.HeaderCell>Buyer / Employee</Table.HeaderCell>
              <Table.HeaderCell>Order Total</Table.HeaderCell>
              <Table.HeaderCell>Current Status</Table.HeaderCell>
              <Table.HeaderCell>Created Date</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Decision Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {isLoading ? (
              <Table.Row>
                <td colSpan={6} className="text-center py-10 text-ui-fg-subtle">
                  Loading approvals...
                </td>
              </Table.Row>
            ) : approvals.length === 0 ? (
              <Table.Row>
                <td colSpan={6} className="text-center py-12">
                  <CheckCircle className="w-8 h-8 text-ui-fg-muted mx-auto mb-2 opacity-50" />
                  <Text className="font-medium text-ui-fg-base">No pending spending approvals</Text>
                  <Text size="small" className="text-ui-fg-subtle mt-1 max-w-sm mx-auto">
                    All corporate purchase orders are within standard authorized credit limits.
                  </Text>
                </td>
              </Table.Row>
            ) : (
              approvals.map((approval) => {
                const customer = approval.cart?.customer
                const customerName = customer
                  ? `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || customer.email
                  : approval.created_by
                const total = approval.cart?.total ?? 0
                const currency = approval.cart?.currency_code ?? "EUR"
                const latestStatus = approval.statuses?.[approval.statuses.length - 1]?.status || "pending"

                return (
                  <Table.Row key={approval.id} className="hover:bg-ui-bg-subtle/50 transition-colors">
                    <Table.Cell className="font-mono text-xs font-semibold text-ui-fg-base">
                      {approval.id}
                    </Table.Cell>

                    <Table.Cell className="text-sm">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-ui-fg-subtle" />
                        <span className="font-medium text-ui-fg-base">{customerName}</span>
                      </div>
                      <div className="text-xs text-ui-fg-subtle mt-0.5 font-mono">
                        Cart: {approval.cart_id.slice(0, 14)}...
                      </div>
                    </Table.Cell>

                    <Table.Cell className="font-mono text-sm font-semibold">
                      {total} {currency.toUpperCase()}
                    </Table.Cell>

                    <Table.Cell>
                      <Badge
                        color={
                          latestStatus === "approved"
                            ? "green"
                            : latestStatus === "rejected"
                            ? "red"
                            : "orange"
                        }
                        size="xsmall"
                      >
                        {latestStatus.toUpperCase()}
                      </Badge>
                    </Table.Cell>

                    <Table.Cell className="text-xs text-ui-fg-subtle">
                      {new Date(approval.created_at).toLocaleDateString()}
                    </Table.Cell>

                    <Table.Cell className="text-right">
                      {latestStatus === "pending" ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="small"
                            variant="secondary"
                            className="text-rose-500 hover:text-rose-600 text-xs py-1"
                            disabled={decideMutation.isPending}
                            onClick={() =>
                              decideMutation.mutate({
                                approvalId: approval.id,
                                status: "rejected",
                              })
                            }
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            Reject
                          </Button>
                          <Button
                            size="small"
                            variant="primary"
                            className="text-xs py-1"
                            disabled={decideMutation.isPending}
                            onClick={() =>
                              decideMutation.mutate({
                                approvalId: approval.id,
                                status: "approved",
                              })
                            }
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />
                            Approve
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-ui-fg-subtle capitalize">
                          Decision recorded
                        </span>
                      )}
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
