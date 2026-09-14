import { defineRouteConfig } from "@medusajs/admin-sdk"
import { BuildingStorefront } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  Heading,
  StatusBadge,
  Text,
  useDataTable,
} from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { sdk } from "../../lib/sdk"

type VendorAdmin = {
  id: string
  first_name?: string | null
  last_name?: string | null
  email: string
}

type VendorProduct = {
  id: string
  title: string
  handle: string
  status?: string
}

type VendorRow = {
  id: string
  name: string
  handle: string
  logo?: string | null
  created_at: string
  admins?: VendorAdmin[]
  products?: VendorProduct[]
}

type VendorListResponse = {
  vendors: VendorRow[]
  count: number
  limit: number
  offset: number
}

const PAGE_SIZE = 15

const columnHelper = createDataTableColumnHelper<VendorRow>()

const VendorsPage = () => {
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })
  const [search, setSearch] = useState("")

  const { data, isLoading, refetch } = useQuery<VendorListResponse>({
    queryFn: () =>
      sdk.client.fetch<VendorListResponse>("/admin/vendors", {
        query: {
          limit: pagination.pageSize,
          offset: pagination.pageIndex * pagination.pageSize,
          ...(search.trim() ? { q: search.trim() } : {}),
        },
      }),
    queryKey: [["admin-vendors", pagination.pageIndex, pagination.pageSize, search]],
  })

  const vendors = useMemo(() => data?.vendors ?? [], [data])
  const count = data?.count ?? 0

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Store & Brand",
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            {row.original.logo ? (
              <img
                src={row.original.logo}
                alt={row.original.name}
                className="w-9 h-9 rounded-xl object-cover border border-ui-border-base shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-ui-bg-subtle-pressed dark:bg-ui-bg-subtle flex items-center justify-center font-bold text-xs text-ui-fg-subtle shrink-0">
                {row.original.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <Link
                to={`/vendors/${row.original.id}`}
                className="font-medium text-ui-fg-base hover:text-ui-fg-interactive transition"
              >
                <Text size="small" weight="plus">
                  {row.original.name}
                </Text>
              </Link>
              <Text size="xsmall" className="text-ui-fg-muted font-mono">
                @{row.original.handle}
              </Text>
            </div>
          </div>
        ),
      }),
      columnHelper.accessor("admins", {
        header: "Primary Contact",
        cell: ({ row }) => {
          const admin = row.original.admins?.[0]
          if (!admin) {
            return <Text size="small" className="text-ui-fg-muted">&mdash;</Text>
          }
          const fullName = [admin.first_name, admin.last_name].filter(Boolean).join(" ")
          return (
            <div>
              {fullName && (
                <Text size="small" weight="plus" className="text-ui-fg-base">
                  {fullName}
                </Text>
              )}
              <Text size="xsmall" className="text-ui-fg-subtle">
                {admin.email}
              </Text>
            </div>
          )
        },
      }),
      columnHelper.accessor("products", {
        header: "Products",
        cell: ({ row }) => (
          <Badge size="2xsmall" rounded="full" className="bg-ui-bg-subtle">
            {row.original.products?.length || 0} Products
          </Badge>
        ),
      }),
      columnHelper.display({
        id: "status",
        header: "Status",
        cell: () => (
          <StatusBadge color="green">Active</StatusBadge>
        ),
      }),
      columnHelper.accessor("created_at", {
        header: "Joined Date",
        cell: ({ row }) => (
          <Text size="small" className="text-ui-fg-subtle">
            {new Date(row.original.created_at).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </Text>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Link to={`/vendors/${row.original.id}`}>
              <Button variant="secondary" size="small">
                View Activity
              </Button>
            </Link>
          </div>
        ),
      }),
    ],
    []
  )

  const table = useDataTable({
    data: vendors,
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
            <Heading level="h2">Vendors</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Monitor multi-vendor marketplace merchants, active catalogs, and store activities.
            </Text>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <DataTable.Search placeholder="Search vendor or handle..." />
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
  label: "Vendors",
  icon: BuildingStorefront,
})

export default VendorsPage
