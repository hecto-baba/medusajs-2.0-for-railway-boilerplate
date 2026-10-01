"use client"

import { listVendorRegions, type VendorRegion } from "@lib/data/vendor-client"
import { GlobeEurope, InformationCircleSolid, PlusMini } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  DataTableSortingState,
  Heading,
  Select,
  Text,
  useDataTable,
} from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { RegionCreateModal } from "./region-create-modal"

const columnHelper = createDataTableColumnHelper<VendorRegion>()

export const RegionsTable = () => {
  const [search, setSearch] = useState("")
  const [currencyFilter, setCurrencyFilter] = useState("all")
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  const order = sorting
    ? (sorting.desc ? "-" : "") + sorting.id
    : undefined

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-regions", { q: search, currency: currencyFilter, order }],
    queryFn: () =>
      listVendorRegions({
        q: search || undefined,
        currency_code: currencyFilter !== "all" ? currencyFilter : undefined,
        order,
      }),
  })

  const allRegions = data?.regions ?? []

  // Extract unique currency codes for filtering
  const availableCurrencies = Array.from(
    new Set(allRegions.map((r) => r.currency_code.toLowerCase()))
  )

  const columns = [
    columnHelper.accessor("name", {
      header: "Region",
      enableSorting: true,
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
      header: "Currency",
      enableSorting: true,
      cell: ({ row }) => (
        <Badge size="small" color="blue">
          {row.original.currency_code?.toUpperCase()}
        </Badge>
      ),
    }),
    columnHelper.accessor("countries", {
      header: "Countries",
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
      header: "Payment Providers",
      cell: ({ row }) => {
        const providers = row.original.payment_providers ?? []
        return (
          <Text size="small" className="text-ui-fg-subtle">
            {providers.length > 0 ? `${providers.length} configured` : "Default"}
          </Text>
        )
      },
    }),
  ]

  const table = useDataTable({
    columns,
    data: allRegions,
    rowCount: allRegions.length,
    getRowId: (row) => row.id,
    isLoading,
    pagination: { state: pagination, onPaginationChange: setPagination },
    search: { state: search, onSearchChange: setSearch },
    sorting: { state: sorting, onSortingChange: setSorting },
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
          <DataTable.Toolbar className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-4">
            <div>
              <Heading level="h2">Regions</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Available store regions and supported customer currencies.
              </Text>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
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

              <Button
                size="small"
                variant="secondary"
                onClick={() => setIsCreateOpen(true)}
                className="shrink-0"
              >
                <PlusMini /> Create Region
              </Button>
            </div>
          </DataTable.Toolbar>
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
