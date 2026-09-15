"use client"

import {
  deleteVendorCustomerGroup,
  listVendorCustomerGroups,
  type VendorCustomerGroup,
} from "@lib/data/vendor-client"
import {
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  DataTableSortingState,
  Heading,
  Text,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { PencilSquare, Trash } from "@medusajs/icons"
import { ActionMenu, DateCell } from "@modules/common"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { CreateGroupModal } from "./create-group-modal"
import { GroupDrawer } from "./group-drawer"

const columnHelper = createDataTableColumnHelper<VendorCustomerGroup>()

export const CustomerGroupsTable = () => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const router = useRouter()

  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)
  const [search, setSearch] = useState<string>("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<VendorCustomerGroup | null>(null)

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit
  const order = sorting
    ? (sorting.desc ? "-" : "") + sorting.id
    : undefined

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-customer-groups", { limit, offset, q: search, order }],
    queryFn: () =>
      listVendorCustomerGroups({
        limit,
        offset,
        q: search || undefined,
        order,
      }),
  })

  const customerGroups = data?.customer_groups ?? []
  const count = data?.count ?? 0

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVendorCustomerGroup(id),
    onSuccess: (_, id) => {
      const deletedGroup = customerGroups.find((g) => g.id === id)
      const name = deletedGroup?.name || "group"
      toast.success(`Customer group ${name} was successfully deleted.`)
      queryClient.invalidateQueries({ queryKey: ["vendor-customer-groups"] })
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete customer group")
    },
  })

  const handleDelete = useCallback(async (group: VendorCustomerGroup) => {
    const name = group.name ?? ""
    const confirmed = await prompt({
      title: "Delete Customer Group",
      description: `You are about to delete the customer group ${name}. This action cannot be undone.`,
      verificationInstruction: "Type to confirm",
      verificationText: name,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (confirmed) {
      deleteMutation.mutate(group.id)
    }
  }, [prompt, deleteMutation])

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Name",
        enableSorting: true,
        sortAscLabel: "A-Z",
        sortDescLabel: "Z-A",
        cell: ({ row }) => {
          return (
            <Link
              href={`/customers/groups/${row.original.id}`}
              className="font-medium text-ui-fg-base hover:text-ui-fg-subtle transition-colors"
            >
              {row.original.name}
            </Link>
          )
        },
      }),
      columnHelper.accessor("customers", {
        header: "Customers",
        cell: ({ row }) => {
          const count = row.original.customers?.length ?? 0
          return <span className="text-ui-fg-subtle text-sm">{count}</span>
        },
      }),
      columnHelper.accessor("created_at", {
        header: "Created",
        enableSorting: true,
        sortAscLabel: "Oldest first",
        sortDescLabel: "Newest first",
        cell: ({ row }) => {
          return <DateCell date={row.original.created_at} />
        },
      }),
      columnHelper.display({
        id: "actions",
        cell: ({ row }) => {
          const group = row.original
          return (
            <ActionMenu
              groups={[
                {
                  actions: [
                    {
                      label: "Edit",
                      icon: <PencilSquare className="h-4 w-4" />,
                      onClick: () => setEditingGroup(group),
                    },
                    {
                      label: "Delete",
                      icon: <Trash className="h-4 w-4" />,
                      onClick: () => handleDelete(group),
                    },
                  ],
                },
              ]}
            />
          )
        },
      }),
    ],
    [handleDelete]
  )

  const table = useDataTable({
    data: customerGroups,
    columns,
    rowCount: count,
    getRowId: (row) => row.id,
    isLoading,
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
    search: {
      state: search,
      onSearchChange: setSearch,
    },
    sorting: {
      state: sorting,
      onSortingChange: setSorting,
    },
  })

  return (
    <Container className="overflow-hidden p-0 divide-y">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h1">Customer Groups</Heading>
        <Button
          variant="secondary"
          size="small"
          onClick={() => setIsCreateOpen(true)}
        >
          Create
        </Button>
      </div>

      {/* Data Table */}
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex items-center justify-between">
          <DataTable.Search placeholder="Search" />
        </DataTable.Toolbar>
        <DataTable.Table
          emptyState={{
            empty: {
              heading: "No customer groups",
              description: "There are no customer groups to display.",
            },
            filtered: {
              heading: "No results",
              description: "No customer groups match the current filter criteria.",
            },
          }}
        />
        <DataTable.Pagination />
      </DataTable>

      {/* Focus Modals & Drawers */}
      <CreateGroupModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />

      <GroupDrawer
        open={Boolean(editingGroup)}
        onOpenChange={(open) => {
          if (!open) setEditingGroup(null)
        }}
        group={editingGroup}
      />
    </Container>
  )
}
