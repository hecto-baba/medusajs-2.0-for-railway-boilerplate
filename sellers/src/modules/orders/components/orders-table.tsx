"use client"

import { listVendorOrders, listVendorRegions, listVendorSalesChannels, type VendorOrder } from "@lib/data/vendor-client"
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
import { useState, useMemo } from "react"
import { OrderExportButton } from "./order-export-button"

const columnHelper = createDataTableColumnHelper<VendorOrder>()
const filterHelper = createDataTableFilterHelper<VendorOrder>()

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
    sortLabel: "Display ID",
    sortAscLabel: "Ascending",
    sortDescLabel: "Descending",
    cell: ({ getValue }) => `#${getValue()}`,
  }),
  columnHelper.accessor("created_at", {
    id: "created_at",
    header: "Date",
    enableSorting: true,
    sortLabel: "Created",
    sortAscLabel: "Ascending",
    sortDescLabel: "Descending",
    cell: ({ getValue }) =>
      new Date(getValue()).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
  }),
  columnHelper.accessor("updated_at", {
    id: "updated_at",
    header: "Updated",
    enableSorting: true,
    sortLabel: "Updated",
    sortAscLabel: "Ascending",
    sortDescLabel: "Descending",
    cell: ({ getValue }) => {
      const val = getValue()
      if (!val) return "—"
      return new Date(val).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    },
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
    cell: ({ row }) =>
      formatAmount(row.original.total, row.original.currency_code),
  }),
]

export const OrdersTable = () => {
  const [search, setSearch] = useState("")
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)
  const [filtering, setFiltering] = useState<DataTableFilteringState>({})
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  // Fetch filter option data
  const { data: regionsData } = useQuery({
    queryKey: ["vendor-regions-for-orders-filter"],
    queryFn: () => listVendorRegions(),
    staleTime: 5 * 60 * 1000,
  })
  const { data: salesChannelsData } = useQuery({
    queryKey: ["vendor-sales-channels-for-orders-filter"],
    queryFn: () => listVendorSalesChannels({ limit: 100, offset: 0 }),
    staleTime: 5 * 60 * 1000,
  })

  // Dynamic filters matching Backend Production
  const filters = useMemo(() => {
    const list: any[] = []

    const regions = regionsData?.regions ?? []
    list.push(
      filterHelper.custom({
        id: "region_id",
        label: "Region",
        type: "select",
        options: regions.map((r) => ({ label: r.name, value: r.id })),
      })
    )

    const channels = salesChannelsData?.sales_channels ?? []
    list.push(
      filterHelper.custom({
        id: "sales_channel_id",
        label: "Sales Channel",
        type: "select",
        options: channels.map((sc) => ({ label: sc.name, value: sc.id })),
      })
    )

    list.push(
      filterHelper.custom({
        id: "created_at_gte",
        label: "Created",
        type: "select",
        options: [
          { label: "Last 7 days", value: "7d" },
          { label: "Last 30 days", value: "30d" },
          { label: "Last 90 days", value: "90d" },
        ],
      })
    )

    list.push(
      filterHelper.custom({
        id: "updated_at_gte",
        label: "Updated",
        type: "select",
        options: [
          { label: "Last 7 days", value: "7d" },
          { label: "Last 30 days", value: "30d" },
          { label: "Last 90 days", value: "90d" },
        ],
      })
    )

    return list
  }, [regionsData, salesChannelsData])

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const order = sorting
    ? (sorting.desc ? "-" : "") + sorting.id
    : undefined

  const regionId = extractFilterValue(filtering.region_id)
  const salesChannelId = extractFilterValue(filtering.sales_channel_id)
  const dateCreatedVal = extractFilterValue(filtering.created_at_gte)
  const dateUpdatedVal = extractFilterValue(filtering.updated_at_gte)

  const createdAtGte = useMemo(() => {
    if (!dateCreatedVal) return undefined
    const days = dateCreatedVal === "7d" ? 7 : dateCreatedVal === "30d" ? 30 : 90
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  }, [dateCreatedVal])

  const updatedAtGte = useMemo(() => {
    if (!dateUpdatedVal) return undefined
    const days = dateUpdatedVal === "7d" ? 7 : dateUpdatedVal === "30d" ? 30 : 90
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  }, [dateUpdatedVal])

  const { data, isLoading } = useQuery({
    queryKey: [
      "vendor-orders",
      limit,
      offset,
      search,
      order,
      regionId,
      salesChannelId,
      createdAtGte,
      updatedAtGte,
    ],
    queryFn: () =>
      listVendorOrders({
        limit,
        offset,
        q: search || undefined,
        order,
        region_id: regionId,
        sales_channel_id: salesChannelId,
        created_at_gte: createdAtGte,
        updated_at_gte: updatedAtGte,
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
            order={order}
            regionId={regionId}
            salesChannelId={salesChannelId}
            createdAtGte={createdAtGte}
            updatedAtGte={updatedAtGte}
            currentOrders={data?.orders}
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

