"use client"

import { listVendorRegions, type VendorRegion } from "@lib/data/vendor-client"
import { GlobeEurope, InformationCircleSolid, PlusMini } from "@medusajs/icons"
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
  Heading,
  Select,
  Text,
  useDataTable,
} from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { RegionCreateModal } from "./region-create-modal"

const columnHelper = createDataTableColumnHelper<VendorRegion>()
const filterHelper = createDataTableFilterHelper<VendorRegion>()

const resolveDateFilter = (val: any): string | undefined => {
  if (!val || val === "all") return undefined
  if (typeof val === "object") {
    if (val.$gte) return typeof val.$gte === "string" ? val.$gte : new Date(val.$gte).toISOString()
    const flat = Object.values(val).flat()
    val = flat[0]
  }
  if (Array.isArray(val)) val = val[0]
  if (typeof val !== "string" || val === "all") return undefined
  if (val === "7d") {
    return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  }
  if (val === "30d") {
    return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  }
  if (val === "90d") {
    return new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  }
  if (!isNaN(Date.parse(val))) {
    return new Date(val).toISOString()
  }
  return undefined
}

const filters = [
  filterHelper.custom({
    id: "created_at",
    label: "Created",
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

export const RegionsTable = () => {
  const [search, setSearch] = useState("")
  const [currencyFilter, setCurrencyFilter] = useState("all")
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)
  const [filtering, setFiltering] = useState<DataTableFilteringState>({})
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    created_at: false,
    updated_at: false,
  })
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  const order = sorting
    ? (sorting.desc ? "-" : "") + sorting.id
    : undefined

  const createdAtGte = useMemo(
    () => resolveDateFilter(filtering.created_at),
    [filtering.created_at]
  )
  const updatedAtGte = useMemo(
    () => resolveDateFilter(filtering.updated_at),
    [filtering.updated_at]
  )

  const { data, isLoading } = useQuery({
    queryKey: [
      "vendor-regions",
      {
        q: search,
        currency: currencyFilter,
        order,
        created_at_gte: createdAtGte,
        updated_at_gte: updatedAtGte,
      },
    ],
    queryFn: () =>
      listVendorRegions({
        q: search || undefined,
        currency_code: currencyFilter !== "all" ? currencyFilter : undefined,
        order,
        created_at_gte: createdAtGte,
        updated_at_gte: updatedAtGte,
      }),
    placeholderData: (previous) => previous,
  })

  const allRegions = data?.regions ?? []

  // Extract unique currency codes for filtering
  const availableCurrencies = Array.from(
    new Set(allRegions.map((r) => r.currency_code.toLowerCase()))
  )

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        id: "name",
        header: "Region",
        enableSorting: true,
        sortLabel: "Name",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
        cell: ({ row }) => (
          <div className="flex items-center gap-x-2">
            <GlobeEurope className="text-ui-fg-subtle h-4 w-4" />
            <Text size="small" weight="plus" className="text-ui-fg-base">
              {row.original.name}
            </Text>
          </div>
        ),
      }),
      columnHelper.accessor("currency_code", {
        id: "currency_code",
        header: "Currency",
        enableSorting: false,
        cell: ({ row }) => (
          <Badge size="small" color="blue">
            {row.original.currency_code?.toUpperCase()}
          </Badge>
        ),
      }),
      columnHelper.accessor("countries", {
        id: "countries",
        header: "Countries",
        enableSorting: false,
        cell: ({ row }) => {
          const countries = row.original.countries ?? []
          if (countries.length === 0) {
            return <Text size="small" className="text-ui-fg-subtle">-</Text>
          }
          if (countries.length <= 3) {
            return (
              <Text size="small" className="text-ui-fg-subtle">
                {countries.map((c) => c.display_name || c.iso_2.toUpperCase()).join(", ")}
              </Text>
            )
          }
          return (
            <Text size="small" className="text-ui-fg-subtle">
              {countries.slice(0, 2).map((c) => c.display_name || c.iso_2.toUpperCase()).join(", ")}
              {" + "}
              {countries.length - 2} more
            </Text>
          )
        },
      }),
      columnHelper.accessor("payment_providers", {
        id: "payment_providers",
        header: "Payment Providers",
        enableSorting: false,
        cell: ({ row }) => {
          const providers = row.original.payment_providers ?? []
          return (
            <Text size="small" className="text-ui-fg-subtle">
              {providers.length > 0 ? `${providers.length} configured` : "Default"}
            </Text>
          )
        },
      }),
      columnHelper.accessor("created_at", {
        id: "created_at",
        header: "Created",
        enableSorting: true,
        sortLabel: "Created",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
        cell: ({ row }) => {
          const date = row.original.created_at
            ? new Date(row.original.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "-"
          return (
            <Text size="small" className="text-ui-fg-subtle">
              {date}
            </Text>
          )
        },
      }),
      columnHelper.accessor("updated_at", {
        id: "updated_at",
        header: "Updated",
        enableSorting: true,
        sortLabel: "Updated",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
        cell: ({ row }) => {
          const date = row.original.updated_at
            ? new Date(row.original.updated_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "-"
          return (
            <Text size="small" className="text-ui-fg-subtle">
              {date}
            </Text>
          )
        },
      }),
    ],
    []
  )

  const table = useDataTable({
    columns,
    data: allRegions,
    rowCount: allRegions.length,
    getRowId: (row) => row.id,
    isLoading,
    pagination: { state: pagination, onPaginationChange: setPagination },
    search: {
      state: search,
      onSearchChange: (val) => {
        setSearch(val)
        setPagination((p) => ({ ...p, pageIndex: 0 }))
      },
    },
    sorting: { state: sorting, onSortingChange: setSorting },
    filtering: {
      state: filtering,
      onFilteringChange: (val) => {
        setFiltering(val)
        setPagination((p) => ({ ...p, pageIndex: 0 }))
      },
    },
    filters,
    columnVisibility: {
      state: columnVisibility,
      onColumnVisibilityChange: setColumnVisibility,
    },
  })

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex items-start gap-x-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-4">
        <InformationCircleSolid className="h-5 w-5 text-ui-fg-interactive shrink-0 mt-0.5" />
        <div className="flex flex-col gap-y-1">
          <Text size="small" weight="plus" className="text-ui-fg-base">
            Store Regions & Supported Currencies
          </Text>
          <Text size="small" className="text-ui-fg-subtle">
            Regions define the markets, currencies, and tax rules where your products can be purchased.
            These apply across your sales channels and catalog pricing.
          </Text>
        </div>
      </div>

      <Container className="p-0">
        <DataTable instance={table}>
          <DataTable.Toolbar className="flex flex-col gap-y-3 px-6 py-4">
            <div className="flex items-center justify-between gap-x-2">
              <div>
                <Heading level="h2">Regions</Heading>
                <Text size="small" className="text-ui-fg-subtle">
                  Available store regions and supported customer currencies.
                </Text>
              </div>
              <Button
                size="small"
                variant="secondary"
                onClick={() => setIsCreateOpen(true)}
                className="shrink-0"
              >
                <PlusMini /> Create Region
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-b pb-3">
              <DataTable.Search placeholder="Search regions..." />

              {availableCurrencies.length > 0 && (
                <div className="w-36">
                  <Select size="small" value={currencyFilter} onValueChange={setCurrencyFilter}>
                    <Select.Trigger>
                      <Select.Value placeholder="Currency" />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="all">All Currencies</Select.Item>
                      {availableCurrencies.map((code) => (
                        <Select.Item key={code} value={code}>
                          {code.toUpperCase()}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>
              )}

              <DataTable.FilterMenu tooltip="Filter" />
              <DataTable.SortingMenu tooltip="Sort" />
            </div>
          </DataTable.Toolbar>

          <DataTable.FilterBar />

          <DataTable.Table />
          <DataTable.Pagination />
        </DataTable>
      </Container>

      <RegionCreateModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </div>
  )
}
