"use client"

import {
  batchVendorCustomerGroups,
  listVendorCustomerGroups,
  type VendorCustomerGroup,
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"

type AddCustomerGroupsModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: string
  existingGroupIds: string[]
  onSuccess?: () => void
}

export const AddCustomerGroupsModal = ({
  open,
  onOpenChange,
  customerId,
  existingGroupIds,
  onSuccess,
}: AddCustomerGroupsModalProps) => {
  const queryClient = useQueryClient()
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [search, setSearch] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-customer-groups", { limit: 100, offset: 0 }],
    queryFn: () => listVendorCustomerGroups({ limit: 100, offset: 0 }),
    enabled: open,
  })

  const groups = data?.customer_groups ?? []

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups
    const term = search.toLowerCase().trim()
    return groups.filter((g) => g.name.toLowerCase().includes(term))
  }, [groups, search])

  const addMutation = useMutation({
    mutationFn: (groupIds: string[]) =>
      batchVendorCustomerGroups(customerId, { add: groupIds }),
    onSuccess: () => {
      const addedNames = groups
        .filter((g) => selectedGroupIds.includes(g.id))
        .map((g) => g.name)
        .join(", ")

      toast.success(`Customer added to: ${addedNames || "groups"}.`)
      queryClient.invalidateQueries({
        queryKey: ["vendor-customer", customerId],
      })
      queryClient.invalidateQueries({ queryKey: ["vendor-customer-groups"] })
      setSelectedGroupIds([])
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add customer to groups")
    },
  })

  const handleToggle = (groupId: string) => {
    if (existingGroupIds.includes(groupId)) return

    setSelectedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    )
  }

  const handleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedGroupIds([])
    } else {
      const selectable = filteredGroups
        .filter((g) => !existingGroupIds.includes(g.id))
        .map((g) => g.id)
      setSelectedGroupIds(selectable)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedGroupIds.length === 0) {
      toast.error("Please select at least one customer group.")
      return
    }

    addMutation.mutate(selectedGroupIds)
  }

  const selectableInView = filteredGroups.filter(
    (g) => !existingGroupIds.includes(g.id)
  )
  const isAllSelected =
    selectableInView.length > 0 &&
    selectableInView.every((g) => selectedGroupIds.includes(g.id))
  const isSomeSelected =
    selectableInView.some((g) => selectedGroupIds.includes(g.id)) &&
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
                disabled={selectedGroupIds.length === 0}
              >
                Save
              </Button>
            </div>
          </FocusModal.Header>

          <FocusModal.Body className="flex flex-1 flex-col overflow-hidden p-0">
            <div className="p-6 border-b">
              <FocusModal.Title asChild>
                <Heading level="h1">Add Customer to Customer Groups</Heading>
              </FocusModal.Title>
              <FocusModal.Description asChild>
                <Text size="small" className="text-ui-fg-subtle mt-1">
                  Select customer groups to add this customer to.
                </Text>
              </FocusModal.Description>

              <div className="relative mt-4 max-w-sm">
                <MagnifyingGlass className="absolute left-3 top-2.5 h-4 w-4 text-ui-fg-muted" />
                <Input
                  size="small"
                  placeholder="Search groups..."
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
                    Loading customer groups...
                  </Text>
                </div>
              ) : filteredGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <Text size="small" className="text-ui-fg-subtle">
                    Please create a customer group first.
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
                      <Table.HeaderCell>Name</Table.HeaderCell>
                      <Table.HeaderCell>Customers</Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {filteredGroups.map((group) => {
                      const isPreSelected = existingGroupIds.includes(group.id)
                      const isSelected =
                        isPreSelected || selectedGroupIds.includes(group.id)

                      const CheckboxEl = (
                        <Checkbox
                          checked={isSelected}
                          disabled={isPreSelected}
                          onCheckedChange={() => handleToggle(group.id)}
                        />
                      )

                      return (
                        <Table.Row
                          key={group.id}
                          className={
                            isPreSelected
                              ? "opacity-60 bg-ui-bg-subtle/40"
                              : "cursor-pointer hover:bg-ui-bg-base-hover"
                          }
                          onClick={() => {
                            if (!isPreSelected) handleToggle(group.id)
                          }}
                        >
                          <Table.Cell
                            className="w-12"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isPreSelected ? (
                              <Tooltip
                                content="The customer is already in this customer group."
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
                              {group.name}
                            </Text>
                          </Table.Cell>
                          <Table.Cell>
                            <Text size="small" className="text-ui-fg-subtle">
                              {group.customers_count ?? group.customers?.length ?? 0}
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
        </form>
      </FocusModal.Content>
    </FocusModal>
  )
}
