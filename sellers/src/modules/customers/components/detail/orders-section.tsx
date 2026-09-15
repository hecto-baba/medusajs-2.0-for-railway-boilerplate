"use client"

import { type VendorCustomer } from "@lib/data/vendor-client"
import {
  Container,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  Heading,
  StatusBadge,
  Text,
  useDataTable,
} from "@medusajs/ui"
import { DateCell, PlaceholderCell } from "@modules/common"
import Link from "next/link"
import { useMemo, useState } from "react"

type OrdersSectionProps = {
  customer: VendorCustomer
}

type OrderRow = NonNullable<VendorCustomer["orders"]>[number]

const columnHelper = createDataTableColumnHelper<OrderRow>()

export const OrdersSection = ({ customer }: OrdersSectionProps) => {
  const [search, setSearch] = useState("")
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const rawOrders = customer.orders ?? []

  const filteredOrders = useMemo(() => {
    if (!search.trim()) return rawOrders
    const term = search.toLowerCase().trim()
    return rawOrders.filter(
      (o) =>
        String(o.display_id ?? "").includes(term) ||
        o.id.toLowerCase().includes(term) ||
        (o.status || "").toLowerCase().includes(term)
    )
  }, [rawOrders, search])

  const count = filteredOrders.length
  const pagedOrders = useMemo(() => {
    const start = pagination.pageIndex * pagination.pageSize
    return filteredOrders.slice(start, start + pagination.pageSize)
  }, [filteredOrders, pagination])

  const columns = useMemo(
    () => [
      columnHelper.accessor("id", {
        header: "Order",
        cell: ({ row }) => {
          const order = row.original
          const display = order.display_id ? `#${order.display_id}` : `#${order.id.slice(-6)}`
          return (
            <Link
              href={`/orders/${order.id}`}
              className="text-ui-fg-interactive hover:underline font-mono text-xs"
            >
              {display}
            </Link>
          )
        },
      }),
      columnHelper.accessor("created_at", {
        header: "Date",
        cell: ({ getValue }) => <DateCell date={getValue()} />,
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: ({ getValue }) => {
          const status = getValue()
          if (!status) return <PlaceholderCell />
          const color =
            status === "completed"
              ? "green"
              : status === "canceled"
              ? "red"
              : status === "pending"
              ? "orange"
              : "grey"
          return <StatusBadge color={color}>{status}</StatusBadge>
        },
      }),
      columnHelper.accessor("total", {
        header: "Total",
        cell: ({ row }) => {
          const order = row.original
          if (typeof order.total !== "number") return <PlaceholderCell />
          const formatted = (order.total / 100).toFixed(2)
          return (
            <Text size="small" weight="plus">
              {formatted} {order.currency_code?.toUpperCase() ?? "USD"}
            </Text>
          )
        },
      }),
    ],
    []
  )

  const table = useDataTable({
    data: pagedOrders,
    columns,
    rowCount: count,
    getRowId: (row) => row.id,
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
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Orders</Heading>
      </div>

      {rawOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <Text size="small" className="text-ui-fg-subtle">
            No orders have been placed by this customer yet.
          </Text>
        </div>
      ) : (
        <DataTable instance={table}>
          <DataTable.Toolbar className="flex items-center justify-between">
            <DataTable.Search placeholder="Search orders..." />
          </DataTable.Toolbar>
          <DataTable.Table />
          <DataTable.Pagination />
        </DataTable>
      )}
    </Container>
  )
}
