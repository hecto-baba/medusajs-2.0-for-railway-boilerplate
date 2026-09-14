"use client"

import { listVendorOrders, type VendorOrder } from "@lib/data/vendor-client"
import {
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  Heading,
  StatusBadge,
  useDataTable,
} from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"

const columnHelper = createDataTableColumnHelper<VendorOrder>()

/**
 * Amounts arrive as major units already (450 means €450.00), so this only
 * formats - it does not divide by 100.
 */
const formatAmount = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
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
    header: "Order",
    cell: ({ getValue }) => `#${getValue()}`,
  }),
  columnHelper.accessor("created_at", {
    header: "Date",
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
  columnHelper.display({
    id: "total",
    header: "Order Total",
    cell: ({ row }) =>
      formatAmount(row.original.total, row.original.currency_code),
  }),
]

export const OrdersTable = () => {
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-orders", limit, offset],
    queryFn: () => listVendorOrders({ limit, offset }),
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
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
  })

  return (
    <DataTable instance={table}>
      <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Orders</Heading>
      </DataTable.Toolbar>
      <DataTable.Table
        emptyState={{
          empty: {
            heading: "No orders yet",
            description: "Orders containing your products will appear here.",
          },
        }}
      />
      <DataTable.Pagination />
    </DataTable>
  )
}
