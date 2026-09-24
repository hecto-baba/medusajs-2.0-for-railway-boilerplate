"use client"

import {
  deleteVendorCustomer,
  listVendorCustomerGroups,
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

const extractFilterVal = (val: any): string | undefined => {
  if (!val) return undefined
  if (typeof val === "string") return val
  if (Array.isArray(val)) return val[0]
  if (typeof val === "object") {
    const flat = Object.values(val).flat()
    return (flat[0] as string) || undefined
  }
  return undefined
}

const resolveDateFilter = (val: any): string | undefined => {
  if (!val || val === "all") return undefined
  if (typeof val === "object") {
    if (val.$gte)
      return typeof val.$gte === "string"
        ? val.$gte
        : new Date(val.$gte).toISOString()
    const flat = Object.values(val).flat()
    val = flat[0]
  }
  if (Array.isArray(val)) val = val[0]
  if (typeof val !== "string" || val === "all") return undefined
  const now = new Date()
  if (val === "7d") {
    now.setDate(now.getDate() - 7)
    return now.toISOString()
  }
  if (val === "30d") {
    now.setDate(now.getDate() - 30)
    return now.toISOString()
  }
  if (val === "90d") {
    now.setDate(now.getDate() - 90)
    return now.toISOString()
  }
  if (!isNaN(Date.parse(val))) {
    return new Date(val).toISOString()
  }
  return undefined
}

export const CustomersTable = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [search, setSearch] = useState("")
  const [filtering, setFiltering] = useState<DataTableFilteringState>({})
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)
  const [columnVisibility, setColumnVisibility] = useState<
    Record<string, boolean>
  >({
    first_name: false,
    last_name: false,
    updated_at: false,
  })
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

  const rawAccount = extractFilterVal(filtering.has_account)
  const accountFilter =
    rawAccount === "true" ? true : rawAccount === "false" ? false : undefined

  const createdAtVal = filtering.created_at ?? filtering.created_at_gte
  const createdAtGte = useMemo(
    () => resolveDateFilter(createdAtVal),
    [createdAtVal]
  )

  const updatedAtVal = filtering.updated_at ?? filtering.updated_at_gte
  const updatedAtGte = useMemo(
    () => resolveDateFilter(updatedAtVal),
    [updatedAtVal]
  )

  const groupsFilterVal = filtering.groups
  const groupIds = useMemo(() => {
    if (!groupsFilterVal) return undefined
    if (Array.isArray(groupsFilterVal)) {
      const filtered = groupsFilterVal.filter(Boolean) as string[]
      return filtered.length ? filtered : undefined
    }
    if (typeof groupsFilterVal === "string") {
      return [groupsFilterVal]
    }
    if (typeof groupsFilterVal === "object") {
      const flat = Object.values(groupsFilterVal)
        .flat()
        .filter(Boolean) as string[]
      return flat.length ? flat : undefined
    }
    return undefined
  }, [groupsFilterVal])

  const order = sorting
    ? (sorting.desc ? "-" : "") + sorting.id
    : undefined

  const { data: customerGroupsData } = useQuery({
    queryKey: ["vendor-customer-groups"],
    queryFn: () => listVendorCustomerGroups({ limit: 100, offset: 0 }),
  })

  const { data, isLoading } = useQuery({
    queryKey: [
      "vendor-customers",
      {
        limit,
        offset,
        q: search,
        has_account: accountFilter,
        groups: groupIds,
        created_at_gte: createdAtGte,
        updated_at_gte: updatedAtGte,
        order,
      },
    ],
    queryFn: () =>
      listVendorCustomers({
        limit,
        offset,
        q: search || undefined,
        has_account: accountFilter,
        groups: groupIds,
        created_at_gte: createdAtGte,
        updated_at_gte: updatedAtGte,
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

  const filters = useMemo(() => {
    const groupOptions = (customerGroupsData?.customer_groups ?? []).map(
      (g) => ({
        label: g.name,
        value: g.id,
      })
    )

    return [
      filterHelper.custom({
        id: "groups",
        label: "Customer Groups",
        type: "select",
        options: groupOptions,
      }),
      filterHelper.accessor("has_account", {
        type: "select",
        label: "Account",
        options: [
          { label: "Registered", value: "true" },
          { label: "Guest", value: "false" },
        ],
      }),
      filterHelper.custom({
        id: "created_at",
        label: "Account Created",
        type: "select",
        options: [
          { label: "Last 7 days", value: "7d" },
          { label: "Last 30 days", value: "30d" },
          { label: "Last 90 days", value: "90d" },
        ],
      }),
      filterHelper.custom({
        id: "updated_at",
        label: "Updated",
        type: "select",
        options: [
          { label: "Last 7 days", value: "7d" },
          { label: "Last 30 days", value: "30d" },
          { label: "Last 90 days", value: "90d" },
        ],
      }),
    ]
  }, [customerGroupsData])

  const columns = useMemo(
    () => [
      columnHelper.accessor("email", {
        header: () => <EmailHeader />,
        enableSorting: true,
        sortLabel: "Email",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
        cell: ({ getValue, row }) => (
          <div
            className="cursor-pointer font-medium hover:text-ui-fg-interactive transition-colors"
            onClick={() => router.push(`/customers/${row.original.id}`)}
          >
            <EmailCell email={getValue()} />
          </div>
        ),
      }),
      columnHelper.accessor("first_name", {
        id: "first_name",
        header: "First Name",
        enableSorting: true,
        sortLabel: "First Name",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
      }),
      columnHelper.accessor("last_name", {
        id: "last_name",
        header: "Last Name",
        enableSorting: true,
        sortLabel: "Last Name",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
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
        enableSorting: false,
        cell: ({ getValue }) => <AccountCell hasAccount={getValue()} />,
      }),
      columnHelper.accessor("created_at", {
        header: () => <FirstSeenHeader />,
        enableSorting: true,
        sortLabel: "Account Created",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
        cell: ({ getValue }) => <DateCell date={getValue()} />,
      }),
      columnHelper.accessor("updated_at", {
        id: "updated_at",
        header: "Updated",
        enableSorting: true,
        sortLabel: "Updated",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
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
    columnVisibility: {
      state: columnVisibility,
      onColumnVisibilityChange: setColumnVisibility,
    },
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
            <DataTable.FilterMenu tooltip="Filter" />
            <DataTable.SortingMenu tooltip="Sort" />
          </div>
        </DataTable.Toolbar>
        <DataTable.FilterBar />
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
