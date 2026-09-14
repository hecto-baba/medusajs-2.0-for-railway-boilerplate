"use client"

import { listVendorRegions, type VendorRegion } from "@lib/data/vendor-client"
import { Buildings, GlobeEurope, InformationCircleSolid } from "@medusajs/icons"
import {
  Badge,
  Container,
  createDataTableColumnHelper,
  DataTable,
  Heading,
  Text,
  useDataTable,
} from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"

const columnHelper = createDataTableColumnHelper<VendorRegion>()

export const RegionsTable = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["vendor-regions"],
    queryFn: () => listVendorRegions(),
  })

  const columns = [
    columnHelper.accessor("name", {
      header: "Region",
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
    data: data?.regions ?? [],
    rowCount: data?.regions?.length ?? 0,
    getRowId: (row) => row.id,
    isLoading,
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
            These are managed at the platform level and automatically apply to your catalog pricing.
          </Text>
        </div>
      </div>

      <Container className="p-0">
        <DataTable instance={table}>
          <DataTable.Toolbar className="flex items-center justify-between gap-x-2 px-6 py-4">
            <div>
              <Heading level="h2">Regions</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Available store regions and supported customer currencies.
              </Text>
            </div>
          </DataTable.Toolbar>
          <DataTable.Table />
        </DataTable>
      </Container>
    </div>
  )
}
