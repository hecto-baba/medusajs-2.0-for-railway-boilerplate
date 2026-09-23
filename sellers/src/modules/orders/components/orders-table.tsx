"use client"

import { listVendorOrders, type VendorOrder } from "@lib/data/vendor-client"
import {
  createDataTableColumnHelper,
  createDataTableFilterHelper,
  DataTable,
  DataTableFilteringState,
  DataTablePaginationState,
  DataTableSortingState,
  Heading,
  StatusBadge,
  useDataTable,
} from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { OrderExportButton } from "./order-export-button"

const columnHelper = createDataTableColumnHelper<VendorOrder>()
const filterHelper = createDataTableFilterHelper<VendorOrder>()

const filters = [
  filterHelper.accessor("status", {
    label: "Status",
    type: "select",
    options: [
      { label: "Pending", value: "pending" },
      { label: "Completed", value: "completed" },
      { label: "Canceled", value: "canceled" },
      { label: "Requires Action", value: "requires_action" },
    ],
  }),
  filterHelper.custom({
    id: "payment_status",
    label: "Payment Status",
    type: "select",
    options: [
      { label: "Captured", value: "captured" },
      { label: "Completed", value: "completed" },
      { label: "Authorized", value: "authorized" },
      { label: "Not Paid", value: "not_paid" },
      { label: "Partially Refunded", value: "partially_refunded" },
      { label: "Refunded", value: "refunded" },
    ],
  }),
  filterHelper.custom({
    id: "fulfillment_status",
    label: "Fulfillment Status",
    type: "select",
    options: [
      { label: "Not Fulfilled", value: "not_fulfilled" },
      { label: "Partially Fulfilled", value: "partially_fulfilled" },
      { label: "Fulfilled", value: "fulfilled" },
      { label: "Shipped", value: "shipped" },
      { label: "Delivered", value: "delivered" },
      { label: "Canceled", value: "canceled" },
    ],
  }),
]

/**
 * Amounts arrive as major units already (450 means €450.00), so this only
 * formats - it does not divide by 100.
 */
const formatAmount = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
  }).format(amount ?? 0)

const paymentBadge = (order: VendorOrder) => {
  const status = order.payment_collections?.[0]?.status ?? "not_paid"

  const color =
    status === "captured" || status === "completed"
      ? "green"
      : status === "authorized"
        ? "orange"
        : "red"

  return (
    <StatusBadge color={color}>
      {status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
    </StatusBadge>
  )
}

const fulfillmentBadge = (order: VendorOrder) => {
  const fulfillments = order.fulfillments ?? []

  const label = !fulfillments.length
    ? "Not fulfilled"
    : fulfillments.some((f) => f.delivered_at)
      ? "Delivered"
      : fulfillments.some((f) => f.shipped_at)
        ? "Shipped"
        : "Fulfilled"

  return (
    <StatusBadge color={label === "Not fulfilled" ? "red" : "green"}>
      {label}
    </StatusBadge>
  )
}

const columns = [
  columnHelper.accessor("display_id", {
    id: "display_id",
    header: "Order",
    enableSorting: true,
    sortLabel: "Order #",
    sortAscLabel: "Ascending",
    sortDescLabel: "Descending",
    cell: ({ getValue }) => `#${getValue()}`,
  }),
  columnHelper.accessor("created_at", {
    id: "created_at",
    header: "Date",
    enableSorting: true,
    sortLabel: "Date",
    sortAscLabel: "Oldest first",
    sortDescLabel: "Newest first",
    cell: ({ getValue }) =>
      new Date(getValue()).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
  }),
  columnHelper.display({
    id: "customer",
    header: "Customer",
    cell: ({ row }) => row.original.customer?.email ?? row.original.email ?? "—",
  }),
  columnHelper.display({
    id: "sales_channel",
    header: "Sales Channel",
    cell: ({ row }) => row.original.sales_channel?.name ?? "—",
  }),
  columnHelper.display({
    id: "payment",
    header: "Payment",
    cell: ({ row }) => paymentBadge(row.original),
  }),
  columnHelper.display({
    id: "fulfillment",
    header: "Fulfillment",
    cell: ({ row }) => fulfillmentBadge(row.original),
  }),
  columnHelper.accessor("total", {
    id: "total",
    header: "Order Total",
    enableSorting: true,
    sortLabel: "Total",
    sortAscLabel: "Lowest first",
    sortDescLabel: "Highest first",
    cell: ({ row }) =>
      formatAmount(row.original.total, row.original.currency_code),
  }),
]

const extractFilterValue = (val: any): string | undefined => {
  if (!val) return undefined
  if (typeof val === "string") return val
  if (Array.isArray(val)) return val[0]
  if (typeof val === "object") {
    const flat = Object.values(val).flat()
    return (flat[0] as string) || undefined
  }
  return undefined
}

export const OrdersTable = () => {
  const [search, setSearch] = useState("")
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)
  const [filtering, setFiltering] = useState<DataTableFilteringState>({})
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const order = sorting
    ? (sorting.desc ? "-" : "") + sorting.id
    : undefined

  const status = extractFilterValue(filtering.status)
  const paymentStatus = extractFilterValue(filtering.payment_status)
  const fulfillmentStatus = extractFilterValue(filtering.fulfillment_status)

  const { data, isLoading } = useQuery({
    queryKey: [
      "vendor-orders",
      limit,
      offset,
      search,
      order,
      status,
      paymentStatus,
      fulfillmentStatus,
    ],
    queryFn: () =>
      listVendorOrders({
        limit,
        offset,
        q: search || undefined,
        order,
        status,
        payment_status: paymentStatus,
        fulfillment_status: fulfillmentStatus,
      }),
    // Without this the table empties on every page change and the row area
    // collapses, which reads as a flash of "no results" mid-navigation.
    placeholderData: (previous) => previous,
  })

  const table = useDataTable({
    data: data?.orders ?? [],
    columns,
    getRowId: (order) => order.id,
    rowCount: data?.count ?? 0,
    isLoading,
    search: {
      state: search,
      onSearchChange: (value) => {
        setSearch(value)
        setPagination((state) => ({ ...state, pageIndex: 0 }))
      },
    },
    sorting: {
      state: sorting,
      onSortingChange: setSorting,
    },
    filtering: {
      state: filtering,
      onFilteringChange: (value) => {
        setFiltering(value)
        setPagination((state) => ({ ...state, pageIndex: 0 }))
      },
    },
    filters,
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
  })

  return (
    <DataTable instance={table}>
      <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Orders</Heading>
        <div className="flex items-center gap-x-2">
          <DataTable.Search placeholder="Search orders..." />
          <DataTable.FilterMenu tooltip="Filter" />
          <DataTable.SortingMenu tooltip="Sort" />
          <OrderExportButton
            search={search}
            status={status}
            paymentStatus={paymentStatus}
            fulfillmentStatus={fulfillmentStatus}
            order={order}
          />
        </div>
      </DataTable.Toolbar>
      <DataTable.FilterBar />
      <DataTable.Table
        emptyState={{
          empty: {
            heading: "No orders yet",
            description: "Orders containing your products will appear here.",
          },
          filtered: {
            heading: "No matches",
            description: "No orders match the selected filters or search query.",
          },
        }}
      />
      <DataTable.Pagination />
    </DataTable>
  )
}

