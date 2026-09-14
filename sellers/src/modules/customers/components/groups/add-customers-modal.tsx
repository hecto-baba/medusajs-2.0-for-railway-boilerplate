"use client"

import {
  batchVendorCustomerGroupMembers,
  listVendorCustomers,
  type VendorCustomer,
} from "@lib/data/vendor-client"
import {
  Avatar,
  Button,
  Checkbox,
  FocusModal,
  Heading,
  Input,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import { MagnifyingGlass } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

type AddCustomersModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  groupId: string
  existingMemberIds: string[]
  onSuccess?: () => void
}

export const AddCustomersModal = ({
  open,
  onOpenChange,
  groupId,
  existingMemberIds,
  onSuccess,
}: AddCustomersModalProps) => {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-customers", { limit: 100, offset: 0, q: search }],
    queryFn: () =>
      listVendorCustomers({
        limit: 100,
        offset: 0,
        q: search || undefined,
      }),
    enabled: open,
  })

  const allCustomers = data?.customers ?? []
  // Filter out customers already in the group
  const availableCustomers = allCustomers.filter(
    (c) => !existingMemberIds.includes(c.id)
  )

  const mutation = useMutation({
    mutationFn: (ids: string[]) =>
      batchVendorCustomerGroupMembers(groupId, { add: ids }),
    onSuccess: () => {
      toast.success("Customers added to group")
      queryClient.invalidateQueries({
        queryKey: ["vendor-customer-group", groupId],
      })
      queryClient.invalidateQueries({ queryKey: ["vendor-customer-groups"] })
      setSelectedIds([])
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add customers")
    },
  })

  const toggleSelectAll = () => {
    if (selectedIds.length === availableCustomers.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(availableCustomers.map((c) => c.id))
    }
  }

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
  }

  const handleSubmit = () => {
    if (!selectedIds.length) {
      toast.error("Please select at least one customer")
      return
    }
    mutation.mutate(selectedIds)
  }

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content className="flex flex-col">
        <FocusModal.Header className="flex items-center justify-between border-b p-4">
          <div>
            <FocusModal.Title asChild>
              <Heading level="h2">Add Customers to Group</Heading>
            </FocusModal.Title>
            <FocusModal.Description asChild>
              <Text size="small" className="text-ui-fg-subtle">
                Select customers from your store to include in this group.
              </Text>
            </FocusModal.Description>
          </div>

          <div className="flex items-center gap-x-2">
            <Button
              variant="secondary"
              size="small"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="small"
              onClick={handleSubmit}
              isLoading={mutation.isPending}
              disabled={selectedIds.length === 0}
            >
              Add ({selectedIds.length})
            </Button>
          </div>
        </FocusModal.Header>

        <FocusModal.Body className="flex flex-1 flex-col p-6 overflow-hidden">
          <div className="mb-4 flex items-center gap-x-2">
            <div className="relative flex-1">
              <MagnifyingGlass className="absolute left-3 top-2.5 h-4 w-4 text-ui-fg-muted" />
              <Input
                placeholder="Search customers..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto border rounded-lg">
            {isLoading ? (
              <div className="flex h-48 items-center justify-center">
                <Text size="small" className="text-ui-fg-subtle">
                  Loading customers...
                </Text>
              </div>
            ) : availableCustomers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center p-6">
                <Text size="small" className="text-ui-fg-subtle">
                  {search
                    ? "No matching customers found."
                    : "All eligible customers are already in this group."}
                </Text>
              </div>
            ) : (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell className="w-12">
                      <Checkbox
                        checked={
                          availableCustomers.length > 0 &&
                          selectedIds.length === availableCustomers.length
                        }
                        onCheckedChange={toggleSelectAll}
                      />
                    </Table.HeaderCell>
                    <Table.HeaderCell>Customer</Table.HeaderCell>
                    <Table.HeaderCell>Phone</Table.HeaderCell>
                    <Table.HeaderCell>Company</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {availableCustomers.map((customer) => {
                    const isChecked = selectedIds.includes(customer.id)
                    const fullName =
                      [customer.first_name, customer.last_name]
                        .filter(Boolean)
                        .join(" ") || "Unnamed"
                    const fallback = (
                      customer.first_name?.[0] ||
                      customer.email?.[0] ||
                      "C"
                    ).toUpperCase()

                    return (
                      <Table.Row
                        key={customer.id}
                        className="cursor-pointer hover:bg-ui-bg-base-hover"
                        onClick={() => toggleSelect(customer.id)}
                      >
                        <Table.Cell
                          onClick={(e) => e.stopPropagation()}
                          className="w-12"
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => toggleSelect(customer.id)}
                          />
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex items-center gap-x-3">
                            <Avatar fallback={fallback} size="small" />
                            <div className="flex flex-col">
                              <Text size="small" weight="plus">
                                {fullName}
                              </Text>
                              <Text size="xsmall" className="text-ui-fg-subtle">
                                {customer.email}
                              </Text>
                            </div>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="small" className="text-ui-fg-subtle">
                            {customer.phone || "-"}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="small" className="text-ui-fg-subtle">
                            {customer.company_name || "-"}
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    )
                  })}
                </Table.Body>
              </Table>
            )}
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}
