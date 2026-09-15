"use client"

import {
  batchVendorCustomerGroups,
  type VendorCustomer,
} from "@lib/data/vendor-client"
import {
  Button,
  Checkbox,
  Container,
  createDataTableColumnHelper,
  createDataTableCommandHelper,
  DataTable,
  DataTablePaginationState,
  DataTableRowSelectionState,
  Heading,
  Text,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { PencilSquare, Trash } from "@medusajs/icons"
import { ActionMenu, DateCell } from "@modules/common"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useMemo, useState } from "react"
import { AddCustomerGroupsModal } from "../forms/add-customer-groups-modal"
import { GroupDrawer } from "../groups/group-drawer"

type GroupsSectionProps = {
  customer: VendorCustomer
}

type CustomerGroupRow = NonNullable<VendorCustomer["groups"]>[number]

const columnHelper = createDataTableColumnHelper<CustomerGroupRow>()
const commandHelper = createDataTableCommandHelper()

export const GroupsSection = ({ customer }: GroupsSectionProps) => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<CustomerGroupRow | null>(null)
  const [search, setSearch] = useState("")
  const [rowSelection, setRowSelection] = useState<DataTableRowSelectionState>({})
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const groups = customer.groups ?? []
  const groupIds = groups.map((g) => g.id)

  const removeMutation = useMutation({
    mutationFn: (toRemoveGroupIds: string[]) =>
      batchVendorCustomerGroups(customer.id, { remove: toRemoveGroupIds }),
    onSuccess: (_, removedIds) => {
      const removedNames = groups
        .filter((g) => removedIds.includes(g.id))
        .map((g) => g.name)
        .join(", ")

      toast.success(`Customer removed from: ${removedNames || "groups"}.`)
      queryClient.invalidateQueries({
        queryKey: ["vendor-customer", customer.id],
      })
      queryClient.invalidateQueries({ queryKey: ["vendor-customer-groups"] })
      setRowSelection({})
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to remove customer from group")
    },
  })

  const handleRemoveSingle = async (group: CustomerGroupRow) => {
    const confirmed = await prompt({
      title: "Are you sure?",
      description: `Are you sure you want to remove the customer from "${group.name}" customer group?`,
      confirmText: "Remove",
      cancelText: "Cancel",
    })

    if (confirmed) {
      removeMutation.mutate([group.id])
    }
  }

  const handleRemoveBatch = async () => {
    const selectedIds = Object.keys(rowSelection).filter(
      (k) => rowSelection[k]
    )

    if (selectedIds.length === 0) return

    const selectedNames = groups
      .filter((g) => selectedIds.includes(g.id))
      .map((g) => g.name)
      .join(", ")

    const confirmed = await prompt({
      title: "Are you sure?",
      description: `Are you sure you want to remove customer from following customer groups: ${selectedNames}?`,
      confirmText: "Remove",
      cancelText: "Cancel",
    })

    if (confirmed) {
      removeMutation.mutate(selectedIds)
    }
  }

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups
    const term = search.toLowerCase().trim()
    return groups.filter((g) => g.name.toLowerCase().includes(term))
  }, [groups, search])

  const count = filteredGroups.length
  const pagedGroups = useMemo(() => {
    const start = pagination.pageIndex * pagination.pageSize
    return filteredGroups.slice(start, start + pagination.pageSize)
  }, [filteredGroups, pagination])

  const columns = useMemo(
    () => [
      columnHelper.select({
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsSomePageRowsSelected()
                ? "indeterminate"
                : table.getIsAllPageRowsSelected()
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            onClick={(e) => e.stopPropagation()}
          />
        ),
      }),
      columnHelper.accessor("name", {
        header: "Name",
        cell: ({ row }) => (
          <Link
            href={`/customers/groups/${row.original.id}`}
            className="text-ui-fg-base hover:text-ui-fg-interactive font-medium transition-colors"
          >
            {row.original.name}
          </Link>
        ),
      }),
      columnHelper.accessor("customers_count", {
        header: "Customers",
        cell: ({ getValue }) => (
          <Text size="small" className="text-ui-fg-subtle">
            {getValue() ?? "-"}
          </Text>
        ),
      }),
      columnHelper.accessor("created_at", {
        header: "Created",
        cell: ({ getValue }) => <DateCell date={getValue()} />,
      }),
      columnHelper.display({
        id: "actions",
        cell: ({ row }) => {
          const g = row.original
          return (
            <ActionMenu
              groups={[
                {
                  actions: [
                    {
                      label: "Edit",
                      icon: <PencilSquare className="h-4 w-4" />,
                      onClick: () => setEditingGroup(g),
                    },
                    {
                      label: "Remove",
                      icon: <Trash className="h-4 w-4" />,
                      onClick: () => handleRemoveSingle(g),
                    },
                  ],
                },
              ]}
            />
          )
        },
      }),
    ],
    []
  )

  const commands = useMemo(
    () => [
      commandHelper.command({
        label: "Remove",
        shortcut: "r",
        action: handleRemoveBatch,
      }),
    ],
    [rowSelection, groups]
  )

  const table = useDataTable({
    data: pagedGroups,
    columns,
    rowCount: count,
    getRowId: (row) => row.id,
    commands,
    rowSelection: {
      state: rowSelection,
      onRowSelectionChange: setRowSelection,
    },
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
    search: {
      state: search,
      onSearchChange: setSearch,
    },
  })

  return (
    <>
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">Customer Groups</Heading>
          <Button
            variant="secondary"
            size="small"
            onClick={() => setIsAddOpen(true)}
          >
            Add
          </Button>
        </div>

        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Text size="small" className="text-ui-fg-subtle">
              This customer doesn&apos;t belong to any group.
            </Text>
          </div>
        ) : (
          <DataTable instance={table}>
            <DataTable.Toolbar className="flex items-center justify-between">
              <DataTable.Search placeholder="Search customer groups..." />
            </DataTable.Toolbar>
            <DataTable.Table />
            <DataTable.Pagination />
            <DataTable.CommandBar />
          </DataTable>
        )}
      </Container>

      <AddCustomerGroupsModal
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        customerId={customer.id}
        existingGroupIds={groupIds}
      />

      <GroupDrawer
        open={Boolean(editingGroup)}
        onOpenChange={(open) => {
          if (!open) setEditingGroup(null)
        }}
        group={editingGroup ? { ...editingGroup, created_at: editingGroup.created_at ?? "" } : null}
      />
    </>
  )
}
