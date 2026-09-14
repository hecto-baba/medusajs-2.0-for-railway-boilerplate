"use client"

import {
  deleteVendorCustomerGroup,
  listVendorCustomerGroups,
  type VendorCustomerGroup,
} from "@lib/data/vendor-client"
import { ActionMenu } from "@modules/common"
import {
  Badge,
  Button,
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
import { Eye, PencilSquare, Plus, Trash } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { GroupDrawer } from "./group-drawer"

const columnHelper = createDataTableColumnHelper<VendorCustomerGroup>()

export const CustomerGroupsTable = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [search, setSearch] = useState("")
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  // Drawer states
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<VendorCustomerGroup | null>(
    null
  )

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
    onSuccess: () => {
      toast.success("Customer group deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-customer-groups"] })
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete customer group")
    },
  })

  const handleDelete = async (group: VendorCustomerGroup) => {
    const confirmed = await prompt({
      title: "Delete Customer Group",
      description: `Are you sure you want to delete "${group.name}"?`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (confirmed) {
      deleteMutation.mutate(group.id)
    }
  }

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Name",
        enableSorting: true,
        cell: ({ row }) => {
          const group = row.original
          return (
            <Link
              href={`/customers/groups/${group.id}`}
              className="text-ui-fg-base hover:text-ui-fg-interactive font-medium transition-colors"
            >
              {group.name}
            </Link>
          )
        },
      }),
      columnHelper.accessor("customers_count", {
        header: "Members",
        cell: ({ getValue }) => {
          const count = getValue() ?? 0
          return (
            <Badge size="small" color="blue">
              {count} {count === 1 ? "customer" : "customers"}
            </Badge>
          )
        },
      }),
      columnHelper.accessor("created_at", {
        header: "Created",
        enableSorting: true,
        cell: ({ getValue }) => {
          const date = getValue()
          return (
            <Text size="small" className="text-ui-fg-subtle">
              {date ? new Date(date).toLocaleDateString() : "-"}
            </Text>
          )
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
                      label: "View Group",
                      icon: <Eye className="h-4 w-4" />,
                      onClick: () => router.push(`/customers/groups/${group.id}`),
                    },
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
    [router]
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
    <div className="flex flex-col gap-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h1">Customer Groups</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Segment your customers into groups for special pricing and promotions.
          </Text>
        </div>

        <Button
          variant="primary"
          size="small"
          onClick={() => setIsCreateOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Create Group
        </Button>
      </div>

      {/* Data Table */}
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex items-center justify-between">
          <DataTable.Search placeholder="Search group name..." />
        </DataTable.Toolbar>
        <DataTable.Table />
        <DataTable.Pagination />
      </DataTable>

      {/* Drawers */}
      <GroupDrawer
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
    </div>
  )
}
