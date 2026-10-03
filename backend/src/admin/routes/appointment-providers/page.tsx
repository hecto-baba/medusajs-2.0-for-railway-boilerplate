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
import { Link, useNavigate } from "react-router-dom"
import { AppointmentResourceDrawer } from "../../components/appointment-resource-drawer"
import { sdk } from "../../lib/sdk"
import { Provider } from "../../types/appointment-booking"

type ProviderListResponse = {
  providers: Provider[]
  count: number
  limit: number
  offset: number
}

const PAGE_SIZE = 15

const columnHelper = createDataTableColumnHelper<Provider>()

const resourceName = (p: Provider) =>
  p.display_name ||
  [p.vendor_admin?.first_name, p.vendor_admin?.last_name].filter(Boolean).join(" ") ||
  p.vendor_admin?.email ||
  p.id

const AppointmentProvidersPage = () => {
  const navigate = useNavigate()
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState(false)

  const { data, isLoading, isError, error, refetch } = useQuery<ProviderListResponse>({
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
        header: "Resource",
        cell: ({ row }) => (
          <Link
            to={`/appointment-providers/${row.original.id}`}
            className="font-medium text-ui-fg-base hover:text-ui-fg-interactive transition"
          >
            <Text size="small" weight="plus">
              {resourceName(row.original)}
            </Text>
          </Link>
        ),
      }),
      columnHelper.display({
        id: "business",
        header: "Business",
        cell: ({ row }) => (
          <Text size="small" className="text-ui-fg-subtle">
            {row.original.vendor?.name ?? row.original.vendor_admin?.email ?? "—"}
          </Text>
        ),
      }),
      columnHelper.accessor("timezone", {
        header: "Timezone",
        cell: ({ row }) => <Badge size="2xsmall">{row.original.timezone}</Badge>,
      }),
      columnHelper.display({
        id: "session",
        header: "Session",
        cell: ({ row }) => (
          <Text size="small" className="text-ui-fg-subtle">
            {row.original.session_duration_minutes} min · {row.original.capacity}{" "}
            {row.original.capacity === 1 ? "person" : "people"}
          </Text>
        ),
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: ({ row }) =>
          row.original.status !== "active" ? (
            <Badge size="2xsmall" color="grey">Inactive</Badge>
          ) : row.original.readiness?.live ? (
            <Badge size="2xsmall" color="green">Live</Badge>
          ) : (
            <Badge size="2xsmall" color="orange">Needs setup</Badge>
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
            <Heading level="h2">Appointment resources</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Every bookable resource across all businesses (staff, rooms, equipment).
              Sellers manage their own; step in here when a seller asks for help.
            </Text>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <DataTable.Search placeholder="Search by resource or business..." />
            <Button variant="secondary" size="small" onClick={() => refetch()}>
              Refresh
            </Button>
            <Button size="small" onClick={() => setCreating(true)}>
              Create resource
            </Button>
          </div>
        </DataTable.Toolbar>
        {isError ? (
          <div className="px-6 py-6">
            <Text size="small" className="text-ui-fg-error">
              {(error as Error)?.message || "Could not load resources."}
            </Text>
          </div>
        ) : null}
        <DataTable.Table />
        <DataTable.Pagination />
      </DataTable>

      <AppointmentResourceDrawer
        open={creating}
        onOpenChange={setCreating}
        onSaved={(created) => navigate(`/appointment-providers/${created.id}`)}
      />
    </Container>
  )
}

export default AppointmentProvidersPage
