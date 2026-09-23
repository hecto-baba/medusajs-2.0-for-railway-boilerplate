"use client"

import {
  batchVendorCustomerGroupMembers,
  listVendorCustomers,
  type VendorCustomer,
} from "@lib/data/vendor-client"
import {
  Button,
  Checkbox,
  FocusModal,
  Heading,
  Input,
  Table,
  Text,
  Tooltip,
  toast,
} from "@medusajs/ui"
import { MagnifyingGlass } from "@medusajs/icons"
import { AccountCell, DateCell } from "@modules/common"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"

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
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([])
  const [search, setSearch] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-customers", { limit: 100, offset: 0 }],
    queryFn: () => listVendorCustomers({ limit: 100, offset: 0 }),
    enabled: open,
  })

  const customers = data?.customers ?? []

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers
    const term = search.toLowerCase().trim()
    return customers.filter((c) => {
      const name = [c.first_name, c.last_name].filter(Boolean).join(" ").toLowerCase()
      const email = (c.email || "").toLowerCase()
      return name.includes(term) || email.includes(term)
    })
  }, [customers, search])

  const addMutation = useMutation({
    mutationFn: (customerIds: string[]) =>
      batchVendorCustomerGroupMembers(groupId, { add: customerIds }),
    onSuccess: () => {
      const count = selectedCustomerIds.length
      toast.success(
        count === 1
          ? "Customer was successfully added to the group."
          : "Customers were successfully added to the group."
      )
      queryClient.invalidateQueries({
        queryKey: ["vendor-customer-group", groupId],
      })
      queryClient.invalidateQueries({ queryKey: ["vendor-customer-groups"] })
      setSelectedCustomerIds([])
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add customers to group")
    },
  })

  const handleToggle = (customerId: string) => {
    if (existingMemberIds.includes(customerId)) return

    setSelectedCustomerIds((prev) =>
      prev.includes(customerId)
        ? prev.filter((id) => id !== customerId)
        : [...prev, customerId]
    )
  }

  const handleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedCustomerIds([])
    } else {
      const selectable = filteredCustomers
        .filter((c) => !existingMemberIds.includes(c.id))
        .map((c) => c.id)
      setSelectedCustomerIds(selectable)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedCustomerIds.length === 0) {
      toast.error("Please select at least one customer.")
      return
    }

    addMutation.mutate(selectedCustomerIds)
  }

  const selectableInView = filteredCustomers.filter(
    (c) => !existingMemberIds.includes(c.id)
  )
  const isAllSelected =
    selectableInView.length > 0 &&
    selectableInView.every((c) => selectedCustomerIds.includes(c.id))
  const isSomeSelected =
    selectableInView.some((c) => selectedCustomerIds.includes(c.id)) &&
    !isAllSelected

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content className="flex flex-col">
        <form onSubmit={handleSubmit} className="flex h-full flex-col overflow-hidden">
          <FocusModal.Header className="flex items-center justify-between border-b p-4">
            <div className="flex items-center gap-x-2">
              <FocusModal.Close asChild>
                <Button size="small" variant="secondary" type="button">
                  Cancel
                </Button>
              </FocusModal.Close>
              <Button
                size="small"
                variant="primary"
                type="submit"
                isLoading={addMutation.isPending}
                disabled={selectedCustomerIds.length === 0}
              >
                Save
              </Button>
            </div>
          </FocusModal.Header>

          <FocusModal.Body className="flex flex-1 flex-col overflow-hidden p-0">
            <div className="p-6 border-b">
              <FocusModal.Title asChild>
                <Heading level="h1">Add Customers to Customer Group</Heading>
              </FocusModal.Title>
              <FocusModal.Description asChild>
                <Text size="small" className="text-ui-fg-subtle mt-1">
                  Select customers to add to this group.
                </Text>
              </FocusModal.Description>

              <div className="relative mt-4 max-w-sm">
                <MagnifyingGlass className="absolute left-3 top-2.5 h-4 w-4 text-ui-fg-muted" />
                <Input
                  size="small"
                  placeholder="Search customers..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex h-48 items-center justify-center">
                  <Text size="small" className="text-ui-fg-subtle">
                    Loading customers...
                  </Text>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <Text size="small" className="text-ui-fg-subtle">
                    Create a customer first.
                  </Text>
                </div>
              ) : (
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell className="w-12">
                        <Checkbox
                          checked={
                            isAllSelected
                              ? true
                              : isSomeSelected
                              ? "indeterminate"
                              : false
                          }
                          onCheckedChange={(val) => handleSelectAll(Boolean(val))}
                        />
                      </Table.HeaderCell>
                      <Table.HeaderCell>Email</Table.HeaderCell>
                      <Table.HeaderCell>Name</Table.HeaderCell>
                      <Table.HeaderCell>Account</Table.HeaderCell>
                      <Table.HeaderCell>First seen</Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {filteredCustomers.map((customer) => {
                      const isPreSelected = existingMemberIds.includes(customer.id)
                      const isSelected =
                        isPreSelected || selectedCustomerIds.includes(customer.id)
                      const fullName =
                        [customer.first_name, customer.last_name]
                          .filter(Boolean)
                          .join(" ") || "—"

                      const CheckboxEl = (
                        <Checkbox
                          checked={isSelected}
                          disabled={isPreSelected}
                          onCheckedChange={() => handleToggle(customer.id)}
                        />
                      )

                      return (
                        <Table.Row
                          key={customer.id}
                          className={
                            isPreSelected
                              ? "opacity-60 bg-ui-bg-subtle/40"
                              : "cursor-pointer hover:bg-ui-bg-base-hover"
                          }
                          onClick={() => {
                            if (!isPreSelected) handleToggle(customer.id)
                          }}
                        >
                          <Table.Cell
                            className="w-12"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isPreSelected ? (
                              <Tooltip
                                content="The customer has already been added to the group."
                                side="right"
                              >
                                <div>{CheckboxEl}</div>
                              </Tooltip>
                            ) : (
                              CheckboxEl
                            )}
                          </Table.Cell>
                          <Table.Cell>
                            <Text size="small" weight="plus">
                              {customer.email}
                            </Text>
                          </Table.Cell>
                          <Table.Cell>
                            <Text size="small" className="text-ui-fg-subtle">
                              {fullName}
                            </Text>
                          </Table.Cell>
                          <Table.Cell>
                            <AccountCell hasAccount={customer.has_account} />
                          </Table.Cell>
                          <Table.Cell>
                            <DateCell date={customer.created_at} />
                          </Table.Cell>
                        </Table.Row>
                      )
                    })}
                  </Table.Body>
                </Table>
              )}
            </div>
          </FocusModal.Body>
        </form>
      </FocusModal.Content>
    </FocusModal>
  )
}
