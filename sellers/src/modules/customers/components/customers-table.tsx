"use client"

import {
  deleteVendorCustomer,
  listVendorCustomers,
  type VendorCustomer,
} from "@lib/data/vendor-client"
import {
  Avatar,
  Badge,
  Button,
  createDataTableColumnHelper,
  createDataTableFilterHelper,
  DataTable,
  DataTableFilteringState,
  DataTablePaginationState,
  DataTableSortingState,
  Heading,
  Text,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { Plus, Trash, PencilSquare, Eye } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { ActionMenu, PlaceholderCell } from "@modules/common"
import { CustomerDrawer } from "./forms/customer-drawer"

const columnHelper = createDataTableColumnHelper<VendorCustomer>()
const filterHelper = createDataTableFilterHelper<VendorCustomer>()

export const CustomersTable = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [search, setSearch] = useState("")
  const [filtering, setFiltering] = useState<DataTableFilteringState>({})
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  // Drawer states
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<VendorCustomer | null>(
    null
  )

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const accountFilter = filtering.has_account as boolean | undefined

  const order = sorting
    ? (sorting.desc ? "-" : "") + sorting.id
    : undefined

  const { data, isLoading } = useQuery({
    queryKey: [
      "vendor-customers",
      { limit, offset, q: search, has_account: accountFilter, order },
    ],
    queryFn: () =>
      listVendorCustomers({
        limit,
        offset,
        q: search || undefined,
        has_account: accountFilter,
        order,
      }),
  })

  const customers = data?.customers ?? []
  const count = data?.count ?? 0

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVendorCustomer(id),
    onSuccess: () => {
      toast.success("Customer removed successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-customers"] })
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to remove customer")
    },
  })

  const handleDelete = async (customer: VendorCustomer) => {
    const customerName =
      [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
      customer.email

    const confirmed = await prompt({
      title: "Remove Customer",
      description: `Are you sure you want to remove "${customerName}" from your store?`,
      confirmText: "Remove",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (confirmed) {
      deleteMutation.mutate(customer.id)
    }
  }

  const filters = useMemo(
    () => [
      filterHelper.accessor("has_account", {
        type: "select",
        label: "Account Status",
        options: [
          { label: "Registered Account", value: "true" },
          { label: "Guest Checkout", value: "false" },
        ],
      }),
    ],
    []
  )

  const columns = useMemo(
    () => [
      columnHelper.accessor("first_name", {
        header: "Customer",
        enableSorting: true,
        cell: ({ row }) => {
          const c = row.original
          const fullName =
            [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed"
          const fallback = (
            c.first_name?.[0] ||
            c.email?.[0] ||
            "C"
          ).toUpperCase()

          return (
            <Link
              href={`/customers/${c.id}`}
              className="flex items-center gap-x-3 group"
            >
              <Avatar fallback={fallback} size="small" />
              <div className="flex flex-col">
                <Text
                  size="small"
                  weight="plus"
                  className="group-hover:text-ui-fg-interactive transition-colors"
                >
                  {fullName}
                </Text>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {c.email}
                </Text>
              </div>
            </Link>
          )
        },
      }),
      columnHelper.accessor("phone", {
        header: "Phone",
        cell: ({ getValue }) => {
          const phone = getValue()
          return phone ? (
            <Text size="small">{phone}</Text>
          ) : (
            <PlaceholderCell />
          )
        },
      }),
      columnHelper.accessor("has_account", {
        header: "Account",
        cell: ({ getValue }) => {
          const hasAccount = getValue()
          return (
            <Badge size="small" color={hasAccount ? "green" : "grey"}>
              {hasAccount ? "Registered" : "Guest"}
            </Badge>
          )
        },
      }),
      columnHelper.accessor("groups", {
        header: "Groups",
        cell: ({ getValue }) => {
          const groups = getValue()
          if (!groups || !groups.length) {
            return <PlaceholderCell />
          }
          return (
            <div className="flex flex-wrap gap-1">
              {groups.map((g) => (
                <Badge key={g.id} size="small" color="blue">
                  {g.name}
                </Badge>
              ))}
            </div>
          )
        },
      }),
      columnHelper.accessor("orders_count", {
        header: "Orders",
        cell: ({ getValue }) => {
          const count = getValue() ?? 0
          return (
            <Badge size="small" color={count > 0 ? "purple" : "grey"}>
              {count} {count === 1 ? "order" : "orders"}
            </Badge>
          )
        },
      }),
      columnHelper.accessor("created_at", {
        header: "Added",
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
          const customer = row.original
          return (
            <ActionMenu
              groups={[
                {
                  actions: [
                    {
                      label: "View Details",
                      icon: <Eye className="h-4 w-4" />,
                      onClick: () => router.push(`/customers/${customer.id}`),
                    },
                    {
                      label: "Edit",
                      icon: <PencilSquare className="h-4 w-4" />,
                      onClick: () => setEditingCustomer(customer),
                    },
                    {
                      label: "Remove",
                      icon: <Trash className="h-4 w-4" />,
                      onClick: () => handleDelete(customer),
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
    data: customers,
    columns,
    rowCount: count,
    getRowId: (row) => row.id,
    isLoading,
    filters,
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
    search: {
      state: search,
      onSearchChange: setSearch,
    },
    filtering: {
      state: filtering,
      onFilteringChange: setFiltering,
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
          <Heading level="h1">Customers</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Manage your store customers, order history, and addresses.
          </Text>
        </div>

        <Button
          variant="primary"
          size="small"
          onClick={() => setIsCreateOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Create Customer
        </Button>
      </div>

      {/* Data Table */}
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex items-center justify-between">
          <div className="flex items-center gap-x-2">
            <DataTable.Search placeholder="Search name, email, phone..." />
            <DataTable.FilterMenu />
          </div>
        </DataTable.Toolbar>
        <DataTable.Table />
        <DataTable.Pagination />
      </DataTable>

      {/* Drawers */}
      <CustomerDrawer
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />

      <CustomerDrawer
        open={Boolean(editingCustomer)}
        onOpenChange={(open) => {
          if (!open) setEditingCustomer(null)
        }}
        customer={editingCustomer}
      />
    </div>
  )
}
