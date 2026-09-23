import { useState, useMemo } from "react"
import { Link, useNavigate } from "react-router-dom"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Badge,
  Button,
  Container,
  createDataTableColumnHelper,
  createDataTableFilterHelper,
  DataTable,
  DataTableFilteringState,
  DataTablePaginationState,
  DataTableSortingState,
  Drawer,
  DropdownMenu,
  Heading,
  IconButton,
  useDataTable,
} from "@medusajs/ui"
import { ChefHat, EllipsisHorizontal, Eye } from "@medusajs/icons"
import { useQuery } from "@tanstack/react-query"
import { sdk } from "../../lib/sdk"
import { CreateRestaurantForm } from "./components/create-restaurant-form"

export type Restaurant = {
  id: string
  name: string
  handle: string
  is_open: boolean
  address?: string
}

type RestaurantsResponse = {
  restaurants: Restaurant[]
  count: number
  limit: number
  offset: number
}

const columnHelper = createDataTableColumnHelper<Restaurant>()
const columns = [
  columnHelper.accessor("name", {
    header: "Name",
    enableSorting: true,
    sortLabel: "Name",
    sortAscLabel: "A-Z",
    sortDescLabel: "Z-A",
    cell: ({ row }) => {
      const restaurant = row.original
      const initial = (restaurant.name || "R").charAt(0).toUpperCase()
      return (
        <div className="flex items-center gap-x-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ui-bg-subtle text-xs font-semibold text-ui-fg-subtle border">
            {initial}
          </div>
          <Link
            to={`/restaurants/${restaurant.id}`}
            className="font-medium text-ui-fg-base hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {restaurant.name}
          </Link>
        </div>
      )
    },
  }),
  columnHelper.accessor("handle", { header: "Handle", enableSorting: true }),
  columnHelper.accessor("is_open", {
    header: "Status",
    cell: ({ getValue }) => {
      const isOpen = getValue()
      return (
        <Badge color={isOpen ? "green" : "grey"} size="xsmall">
          {isOpen ? "Open" : "Closed"}
        </Badge>
      )
    },
  }),
  columnHelper.accessor("address", {
    header: "Address",
    cell: ({ getValue }) => getValue() || "-",
  }),
  columnHelper.display({
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      const restaurant = row.original
      return (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <IconButton size="small" variant="transparent">
                <EllipsisHorizontal />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content className="min-w-[180px]">
              <DropdownMenu.Item
                className="gap-x-2"
                asChild
              >
                <Link to={`/restaurants/${restaurant.id}`}>
                  <Eye className="text-ui-fg-subtle" />
                  <span>View Details & Menu</span>
                </Link>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
      )
    },
  }),
]

const filterHelper = createDataTableFilterHelper<Restaurant>()
const filters = [
  filterHelper.accessor("is_open", {
    type: "select",
    label: "Status",
    options: [
      { label: "Open", value: "true" },
      { label: "Closed", value: "false" },
    ],
  }),
]

const limit = 15

const RestaurantsPage = () => {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageSize: limit,
    pageIndex: 0,
  })
  const [search, setSearch] = useState<string>("")
  const [filtering, setFiltering] = useState<DataTableFilteringState>({})
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)
  const offset = useMemo(() => pagination.pageIndex * limit, [pagination])

  const { data, isLoading } = useQuery<RestaurantsResponse>({
    queryKey: [
      "restaurants",
      limit,
      offset,
      search,
      filtering,
      sorting?.id,
      sorting?.desc,
    ],
    queryFn: () =>
      sdk.client.fetch("/admin/restaurants", {
        query: {
          limit,
          offset,
          q: search || undefined,
          is_open: filtering.is_open,
          order: sorting
            ? `${sorting.desc ? "-" : ""}${sorting.id}`
            : undefined,
        },
      }),
  })

  const table = useDataTable({
    columns,
    data: data?.restaurants || [],
    getRowId: (row) => row.id,
    rowCount: data?.count || 0,
    isLoading,
    pagination: { state: pagination, onPaginationChange: setPagination },
    search: { state: search, onSearchChange: setSearch },
    filtering: { state: filtering, onFilteringChange: setFiltering },
    filters,
    sorting: { state: sorting, onSortingChange: setSorting },
    onRowClick: (_event, row) => navigate(`/restaurants/${row.id}`),
  })

  return (
    <Container className="divide-y p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex flex-col items-start justify-between gap-2 p-4 md:flex-row md:items-center">
          <Heading level="h2">Restaurants</Heading>
          <div className="flex items-center gap-2">
            <DataTable.FilterMenu tooltip="Filter" />
            <DataTable.SortingMenu tooltip="Sort" />
            <DataTable.Search placeholder="Search restaurants..." />
            <Drawer open={open} onOpenChange={setOpen}>
              <Drawer.Trigger asChild>
                <Button size="small" variant="secondary">
                  Create Restaurant
                </Button>
              </Drawer.Trigger>
              <Drawer.Content>
                <Drawer.Header>
                  <Drawer.Title>Create Restaurant</Drawer.Title>
                </Drawer.Header>
                <CreateRestaurantForm
                  onSuccess={() => setOpen(false)}
                  onCancel={() => setOpen(false)}
                />
              </Drawer.Content>
            </Drawer>
          </div>
        </DataTable.Toolbar>
        <DataTable.Table />
        <DataTable.Pagination />
      </DataTable>
    </Container>
  )
}

export default RestaurantsPage

