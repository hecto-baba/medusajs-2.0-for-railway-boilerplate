import { useState } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
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
  CheckCircle,
  EllipsisHorizontal,
  Eye,
  XCircle,
} from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../lib/sdk"

const ApprovalsPage = () => {
  const queryClient = useQueryClient()
  const [selectedApproval, setSelectedApproval] = useState<any>(null)
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 })

  const { data, isLoading } = useQuery({
    queryKey: ["approvals", pagination],
    queryFn: () =>
      sdk.client.fetch<any>("/admin/approvals", {
        query: {
          limit: pagination.pageSize,
          offset: pagination.pageIndex * pagination.pageSize,
        },
      }),
  })

  const { mutateAsync: updateApprovalStatus, isPending } = useMutation({
    mutationFn: ({ approval_id, status }: { approval_id: string; status: string }) =>
      sdk.client.fetch("/admin/approvals", {
        method: "POST",
        body: { approval_id, status },
      }),
    onSuccess: (_, variables) => {
      toast.success("Updated", {
        description: `Approval request marked as ${variables.status}.`,
      })
      queryClient.invalidateQueries({ queryKey: ["approvals"] })
    },
    onError: (err: any) => {
      toast.error("Error", {
        description: err.message || "Failed to update approval",
      })
    },
  })

  const approvals = data?.approvals || []

  return (
    <Container className="p-0 divide-y">
      <div className="flex items-center justify-between p-6">
        <div>
          <Heading level="h2">Approvals</Heading>
          <Text className="text-ui-fg-subtle text-sm">
            Review and authorize orders exceeding employee spending limits.
          </Text>
        </div>
      </div>

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Cart ID</Table.HeaderCell>
            <Table.HeaderCell>Employee</Table.HeaderCell>
            <Table.HeaderCell>Order Total</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {approvals.length === 0 ? (
            <Table.Row>
              <Table.Cell colSpan={5} className="py-12 text-center">
                <div className="flex flex-col items-center justify-center gap-y-2">
                  <CheckCircle className="text-ui-fg-muted" />
                  <Text weight="plus">No approvals found</Text>
                  <Text size="small" className="text-ui-fg-subtle">
                    There are currently no orders requiring approval.
                  </Text>
                </div>
              </Table.Cell>
            </Table.Row>
          ) : (
            approvals.map((approval: any) => {
              const latestStatus =
                approval.statuses?.[approval.statuses.length - 1]?.status || "pending"
              const customer = approval.cart?.customer || {}
              const customerName =
                [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
                customer.email ||
                approval.created_by ||
                "-"
              const currency = (approval.cart?.currency_code || "eur").toUpperCase()
              const total = approval.cart?.total
                ? `${Number(approval.cart.total).toFixed(2)} ${currency}`
                : "-"

              return (
                <Table.Row key={approval.id}>
                  <Table.Cell className="font-mono text-xs font-semibold">
                    {approval.cart_id}
                  </Table.Cell>
                  <Table.Cell>
                    <div>
                      <span className="font-medium">{customerName}</span>
                      {customer.email && (
                        <Text className="text-ui-fg-subtle text-xs">{customer.email}</Text>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell className="font-semibold">{total}</Table.Cell>
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
                  <Table.Cell className="text-right">
                    <DropdownMenu>
                      <DropdownMenu.Trigger asChild>
                        <IconButton size="small" variant="transparent">
                          <EllipsisHorizontal />
                        </IconButton>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Content className="min-w-[180px]">
                        <DropdownMenu.Item
                          className="gap-x-2"
                          onClick={() => setSelectedApproval(approval)}
                        >
                          <Eye className="text-ui-fg-subtle" />
                          <span>Review Cart Items</span>
                        </DropdownMenu.Item>

                        {latestStatus === "pending" && (
                          <>
                            <DropdownMenu.Separator />
                            <DropdownMenu.Item
                              className="gap-x-2 text-ui-fg-interactive"
                              onClick={() =>
                                updateApprovalStatus({
                                  approval_id: approval.id,
                                  status: "approved",
                                })
                              }
                            >
                              <CheckCircle className="text-ui-fg-interactive" />
                              <span>Approve Order</span>
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                              className="gap-x-2 text-ui-fg-error"
                              onClick={() =>
                                updateApprovalStatus({
                                  approval_id: approval.id,
                                  status: "rejected",
                                })
                              }
                            >
                              <XCircle className="text-ui-fg-error" />
                              <span>Reject Order</span>
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

      {/* Review Approval Items Modal */}
      {selectedApproval && (
        <FocusModal
          open={Boolean(selectedApproval)}
          onOpenChange={(open) => !open && setSelectedApproval(null)}
        >
          <FocusModal.Content className="max-w-2xl mx-auto my-auto rounded-lg border bg-ui-bg-base p-6 shadow-elevation-modal">
            <FocusModal.Header className="pb-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <Heading level="h2">
                    Review Cart: {selectedApproval.cart_id}
                  </Heading>
                  <Text className="text-ui-fg-subtle text-sm">
                    Requester:{" "}
                    {selectedApproval.cart?.customer?.email || selectedApproval.created_by}
                  </Text>
                </div>
                <Badge
                  color={
                    (selectedApproval.statuses?.[selectedApproval.statuses.length - 1]?.status ||
                      "pending") === "approved"
                      ? "green"
                      : "orange"
                  }
                  size="small"
                >
                  {(
                    selectedApproval.statuses?.[selectedApproval.statuses.length - 1]?.status ||
                    "pending"
                  ).toUpperCase()}
                </Badge>
              </div>
            </FocusModal.Header>

            <FocusModal.Body className="py-6 flex flex-col gap-y-4">
              <Heading level="h3" className="text-base">
                Cart Items
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
                  {(selectedApproval.cart?.items || []).length === 0 ? (
                    <Table.Row>
                      <Table.Cell colSpan={3} className="text-center py-4 text-ui-fg-subtle">
                        No line item details found.
                      </Table.Cell>
                    </Table.Row>
                  ) : (
                    selectedApproval.cart.items.map((item: any) => (
                      <Table.Row key={item.id}>
                        <Table.Cell className="font-medium">{item.title}</Table.Cell>
                        <Table.Cell>{item.quantity}</Table.Cell>
                        <Table.Cell className="text-right font-medium">
                          {item.unit_price}{" "}
                          {(selectedApproval.cart?.currency_code || "EUR").toUpperCase()}
                        </Table.Cell>
                      </Table.Row>
                    ))
                  )}
                </Table.Body>
              </Table>

              <div className="flex justify-between items-center pt-2 border-t font-semibold">
                <span>Order Total</span>
                <span>
                  {selectedApproval.cart?.total || 0}{" "}
                  {(selectedApproval.cart?.currency_code || "EUR").toUpperCase()}
                </span>
              </div>
            </FocusModal.Body>

            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="secondary"
                size="small"
                onClick={() => setSelectedApproval(null)}
              >
                Close
              </Button>
              {(selectedApproval.statuses?.[selectedApproval.statuses.length - 1]?.status ||
                "pending") === "pending" && (
                <div className="flex items-center gap-x-2">
                  <Button
                    variant="danger"
                    size="small"
                    onClick={async () => {
                      await updateApprovalStatus({
                        approval_id: selectedApproval.id,
                        status: "rejected",
                      })
                      setSelectedApproval(null)
                    }}
                    isLoading={isPending}
                  >
                    Reject Order
                  </Button>
                  <Button
                    size="small"
                    onClick={async () => {
                      await updateApprovalStatus({
                        approval_id: selectedApproval.id,
                        status: "approved",
                      })
                      setSelectedApproval(null)
                    }}
                    isLoading={isPending}
                  >
                    Approve Order
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

export default ApprovalsPage
