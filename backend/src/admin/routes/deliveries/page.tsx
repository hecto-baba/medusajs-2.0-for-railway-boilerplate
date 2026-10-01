import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Badge,
  Container,
  createDataTableColumnHelper,
  createDataTableFilterHelper,
  DataTable,
  DataTableFilteringState,
  DataTablePaginationState,
  DataTableSortingState,
  Heading,
  useDataTable,
} from "@medusajs/ui"
import { FlyingBox } from "@medusajs/icons"
import { useQuery } from "@tanstack/react-query"
import { sdk } from "../../lib/sdk"

export enum DeliveryStatus {
  PENDING = "pending",
  RESTAURANT_DECLINED = "restaurant_declined",
  RESTAURANT_ACCEPTED = "restaurant_accepted",
  PICKUP_CLAIMED = "pickup_claimed",
  RESTAURANT_PREPARING = "restaurant_preparing",
  READY_FOR_PICKUP = "ready_for_pickup",
  IN_TRANSIT = "in_transit",
  DELIVERED = "delivered",
}

type Driver = {
  id: string
  first_name: string
  last_name: string
  phone: string
}

export type Delivery = {
  id: string
  transaction_id?: string | null
  delivery_status: DeliveryStatus
  eta?: string | null
  delivered_at?: string | null
  driver?: Driver | null
}

type DeliveriesResponse = {
  deliveries: Delivery[]
  count: number
  limit: number
  offset: number
}

// 1. Column definitions
const columnHelper = createDataTableColumnHelper<Delivery>()

const columns = [
  columnHelper.accessor("id", {
    header: "Delivery ID",
    enableSorting: false,
  }),
  columnHelper.accessor("transaction_id", {
    header: "Transaction ID",
    enableSorting: false,
    cell: ({ getValue }) => getValue() || "-",
  }),
  columnHelper.accessor("delivery_status", {
    header: "Status",
    enableSorting: true,
    sortLabel: "Status",
    cell: ({ getValue }) => {
      const status = getValue()
      let color: "green" | "blue" | "orange" | "red" | "grey" = "grey"

      switch (status) {
        case DeliveryStatus.DELIVERED:
          color = "green"
          break
        case DeliveryStatus.IN_TRANSIT:
        case DeliveryStatus.PICKUP_CLAIMED:
          color = "blue"
          break
        case DeliveryStatus.RESTAURANT_PREPARING:
        case DeliveryStatus.READY_FOR_PICKUP:
        case DeliveryStatus.RESTAURANT_ACCEPTED:
          color = "orange"
          break
        case DeliveryStatus.RESTAURANT_DECLINED:
          color = "red"
          break
        default:
          color = "grey"
      }

      return (
        <Badge color={color} size="xsmall">
          {status.replace(/_/g, " ")}
        </Badge>
      )
    },
  }),
  columnHelper.accessor("driver", {
    header: "Assigned Driver",
    cell: ({ getValue }) => {
      const driver = getValue()
      if (!driver) {
        return "Unassigned"
      }
      return (
        <div className="flex flex-col">
          <span>{`${driver.first_name} ${driver.last_name}`}</span>
          <span className="text-ui-fg-subtle text-xs">{driver.phone}</span>
        </div>
      )
    },
  }),
  columnHelper.accessor("eta", {
    header: "ETA",
    enableSorting: true,
    sortLabel: "ETA",
    cell: ({ getValue }) => {
      const val = getValue()
      return val ? new Date(val).toLocaleString() : "-"
    },
  }),
  columnHelper.accessor("delivered_at", {
    header: "Delivered At",
    enableSorting: true,
    sortLabel: "Delivered At",
    cell: ({ getValue }) => {
      const val = getValue()
      return val ? new Date(val).toLocaleString() : "-"
    },
  }),
]

// 2. Filter definitions
const filterHelper = createDataTableFilterHelper<Delivery>()

const filters = [
  filterHelper.accessor("delivery_status", {
    type: "select",
    label: "Status",
    options: Object.values(DeliveryStatus).map((status) => ({
      label: status.replace(/_/g, " "),
      value: status,
    })),
  }),
]

const limit = 15

const DeliveriesPage = () => {
  const navigate = useNavigate()

  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageSize: limit,
    pageIndex: 0,
  })
  const [search, setSearch] = useState<string>("")
  const [filtering, setFiltering] = useState<DataTableFilteringState>({})
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)

  const offset = useMemo(() => {
    return pagination.pageIndex * limit
  }, [pagination])

  const { data, isLoading } = useQuery<DeliveriesResponse>({
    queryKey: [
      "deliveries",
      limit,
      offset,
      search,
      filtering,
      sorting?.id,
      sorting?.desc,
    ],
    queryFn: () =>
      sdk.client.fetch("/admin/deliveries", {
        query: {
          limit,
          offset,
          q: search || undefined,
          status: filtering.delivery_status,
          order: sorting
            ? `${sorting.desc ? "-" : ""}${sorting.id}`
            : undefined,
        },
      }),
  })

  // 3. DataTable configuration with onRowClick navigation
  const table = useDataTable({
    columns,
    data: data?.deliveries || [],
    getRowId: (row) => row.id,
    rowCount: data?.count || 0,
    isLoading,
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
    filters,
    sorting: {
      state: sorting,
      onSortingChange: setSorting,
    },
    onRowClick: (_event, row) => {
      navigate(`/deliveries/${row.id}`)
    },
  })

  return (
    <Container className="divide-y p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex flex-col items-start justify-between gap-2 p-4 md:flex-row md:items-center">
          <Heading level="h2">Deliveries</Heading>
          <div className="flex items-center gap-2">
            <DataTable.FilterMenu tooltip="Filter" />
            <DataTable.SortingMenu tooltip="Sort" />
            <DataTable.Search placeholder="Search deliveries..." />
          </div>
        </DataTable.Toolbar>

        <DataTable.Table />
        <DataTable.Pagination />
      </DataTable>
    </Container>
  )
}

export default DeliveriesPage

