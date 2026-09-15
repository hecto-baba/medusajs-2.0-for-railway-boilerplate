"use client"

import {
  deleteVendorCustomer,
  listVendorCustomers,
  type VendorCustomer,
} from "@lib/data/vendor-client"
import {
  Button,
  Container,
  createDataTableColumnHelper,
  createDataTableFilterHelper,
  DataTable,
  DataTableFilteringState,
  DataTablePaginationState,
  DataTableSortingState,
  Heading,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { PencilSquare, Trash } from "@medusajs/icons"
import {
  AccountCell,
  AccountHeader,
  ActionMenu,
  DateCell,
  EmailCell,
  EmailHeader,
  FirstSeenHeader,
  NameCell,
  NameHeader,
} from "@modules/common"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { CustomerDrawer } from "./forms/customer-drawer"
import { CreateCustomerModal } from "./forms/create-customer-modal"

const columnHelper = createDataTableColumnHelper<VendorCustomer>()
const filterHelper = createDataTableFilterHelper<VendorCustomer>()

const PAGE_SIZE = 20

export const CustomersTable = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [search, setSearch] = useState("")
  const [filtering, setFiltering] = useState<DataTableFilteringState>({})
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })

  // Modal / Drawer states
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
    onSuccess: (_, id) => {
      const deletedCustomer = customers.find((c) => c.id === id)
      toast.success(
        `Customer ${deletedCustomer?.email || "customer"} was successfully deleted.`
      )
      queryClient.invalidateQueries({ queryKey: ["vendor-customers"] })
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete customer")
    },
  })

  const handleDelete = async (customer: VendorCustomer) => {
    const confirmed = await prompt({
      title: "Delete Customer",
      description: `You are about to delete the customer ${customer.email}. This action cannot be undone.`,
      verificationInstruction: "Type to confirm",
      verificationText: customer.email,
      confirmText: "Delete",
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
        label: "Account",
        options: [
          { label: "Registered", value: "true" },
          { label: "Guest", value: "false" },
        ],
      }),
    ],
    []
  )

  const columns = useMemo(
    () => [
      columnHelper.accessor("email", {
        header: () => <EmailHeader />,
        enableSorting: true,
        sortAscLabel: "A-Z",
        sortDescLabel: "Z-A",
        cell: ({ getValue, row }) => (
          <div
            className="cursor-pointer font-medium hover:text-ui-fg-interactive transition-colors"
            onClick={() => router.push(`/customers/${row.original.id}`)}
          >
            <EmailCell email={getValue()} />
          </div>
        ),
      }),
      columnHelper.display({
        id: "name",
        header: () => <NameHeader />,
        cell: ({
          row: {
            original: { first_name, last_name },
          },
        }) => <NameCell firstName={first_name} lastName={last_name} />,
      }),
      columnHelper.accessor("has_account", {
        header: () => <AccountHeader />,
        enableSorting: true,
        cell: ({ getValue }) => <AccountCell hasAccount={getValue()} />,
      }),
      columnHelper.accessor("created_at", {
        header: () => <FirstSeenHeader />,
        enableSorting: true,
        sortAscLabel: "Oldest first",
        sortDescLabel: "Newest first",
        cell: ({ getValue }) => <DateCell date={getValue()} />,
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
                      label: "Edit",
                      icon: <PencilSquare className="h-4 w-4" />,
                      onClick: () => setEditingCustomer(customer),
                    },
                    {
                      label: "Delete",
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
    <Container className="divide-y p-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h1">Customers</Heading>
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
          <div className="flex items-center gap-x-2">
            <DataTable.Search placeholder="Search" />
            <DataTable.FilterMenu />
          </div>
        </DataTable.Toolbar>
        <DataTable.Table
          emptyState={{
            empty: {
              heading: "No customers",
              description: "Your customers will show up here.",
            },
            filtered: {
              heading: "No results",
              description: "No customers match the current filter criteria.",
            },
          }}
        />
        <DataTable.Pagination />
      </DataTable>

      {/* Focus Modals & Drawers */}
      <CreateCustomerModal
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
    </Container>
  )
}
