import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Calendar } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  Heading,
  Text,
  useDataTable,
} from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { sdk } from "../../lib/sdk"

type ProviderRow = {
  id: string
  display_name: string | null
  timezone: string
  status: "active" | "inactive"
  vendor_admin?: {
    email: string
    first_name?: string | null
    last_name?: string | null
  } | null
}

type ProviderListResponse = {
  providers: ProviderRow[]
  count: number
  limit: number
  offset: number
}

const PAGE_SIZE = 15

const columnHelper = createDataTableColumnHelper<ProviderRow>()

const AppointmentProvidersPage = () => {
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })
  const [search, setSearch] = useState("")

  const { data, isLoading, refetch } = useQuery<ProviderListResponse>({
    queryFn: () =>
      sdk.client.fetch<ProviderListResponse>("/admin/providers", {
        query: {
          limit: pagination.pageSize,
          offset: pagination.pageIndex * pagination.pageSize,
          ...(search.trim() ? { q: search.trim() } : {}),
        },
      }),
    queryKey: [["admin-providers", pagination.pageIndex, pagination.pageSize, search]],
  })

  const providers = useMemo(() => data?.providers ?? [], [data])
  const count = data?.count ?? 0

  const columns = useMemo(
    () => [
      columnHelper.accessor("display_name", {
        header: "Provider",
        cell: ({ row }) => {
          const name =
            row.original.display_name ||
            [row.original.vendor_admin?.first_name, row.original.vendor_admin?.last_name]
              .filter(Boolean)
              .join(" ") ||
            row.original.vendor_admin?.email ||
            row.original.id

          return (
            <Link
              to={`/appointment-providers/${row.original.id}`}
              className="font-medium text-ui-fg-base hover:text-ui-fg-interactive transition"
            >
              <Text size="small" weight="plus">
                {name}
              </Text>
            </Link>
          )
        },
      }),
      columnHelper.accessor("vendor_admin", {
        header: "Contact",
        cell: ({ row }) => (
          <Text size="small" className="text-ui-fg-subtle">
            {row.original.vendor_admin?.email || "—"}
          </Text>
        ),
      }),
      columnHelper.accessor("timezone", {
        header: "Timezone",
        cell: ({ row }) => (
          <Badge size="2xsmall">{row.original.timezone}</Badge>
        ),
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: ({ row }) => (
          <Badge
            size="2xsmall"
            color={row.original.status === "active" ? "green" : "grey"}
          >
            {row.original.status === "active" ? "Active" : "Inactive"}
          </Badge>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Link to={`/appointment-providers/${row.original.id}`}>
              <Button variant="secondary" size="small">
                Manage
              </Button>
            </Link>
          </div>
        ),
      }),
    ],
    []
  )

  const table = useDataTable({
    data: providers,
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
  })

  return (
    <Container className="divide-y p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:px-6">
          <div>
            <Heading level="h2">Appointment Providers</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Every staff member with a bookable calendar. Manage a provider's
              schedule directly if a seller asks for help or needs support.
            </Text>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <DataTable.Search placeholder="Search providers..." />
            <Button variant="secondary" size="small" onClick={() => refetch()}>
              Refresh
            </Button>
          </div>
        </DataTable.Toolbar>
        <DataTable.Table />
        <DataTable.Pagination />
      </DataTable>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Appointment Providers",
  icon: Calendar,
})

export default AppointmentProvidersPage
