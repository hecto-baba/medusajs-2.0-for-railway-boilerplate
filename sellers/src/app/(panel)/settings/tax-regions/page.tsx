"use client"

import { PlusMini } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  Heading,
  Text,
  useDataTable,
} from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { listVendorRegions } from "@lib/data/vendor-client"

type TaxRegionRow = {
  id: string
  country_code: string
  name: string
  rate: string
  updated_at?: string
}

const columnHelper = createDataTableColumnHelper<TaxRegionRow>()

export default function TaxRegionsPage() {
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  const { data: regionsData, isLoading } = useQuery({
    queryKey: ["vendor-regions-taxes"],
    queryFn: () => listVendorRegions(),
  })

  const rows: TaxRegionRow[] = (regionsData?.regions ?? []).flatMap((r) =>
    (r.countries ?? []).map((c) => ({
      id: `${r.id}-${c.iso_2}`,
      country_code: c.iso_2.toUpperCase(),
      name: c.display_name,
      rate: "Default",
      updated_at: r.updated_at || r.created_at,
    }))
  )

  const columns = [
    columnHelper.accessor("country_code", {
      header: "Country",
      cell: ({ row }) => (
        <div className="flex items-center gap-x-2">
          <Badge size="2xsmall">{row.original.country_code}</Badge>
          <Text size="small" weight="plus">
            {row.original.name}
          </Text>
        </div>
      ),
    }),
    columnHelper.accessor("rate", {
      header: "Default Tax Rate",
      cell: ({ row }) => (
        <Text size="small" className="text-ui-fg-subtle">
          {row.original.rate}
        </Text>
      ),
    }),
  ]

  const table = useDataTable({
    columns,
    data: rows,
    rowCount: rows.length,
    getRowId: (row) => row.id,
    isLoading,
    pagination: { state: pagination, onPaginationChange: setPagination },
  })

  return (
    <div className="flex flex-col gap-y-3 p-6">
      <Container className="p-0">
        <DataTable instance={table}>
          <DataTable.Toolbar className="flex items-center justify-between gap-x-2 px-6 py-4">
            <div>
              <Heading level="h2">Tax Regions</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Manage how taxes are calculated across your regions and countries.
              </Text>
            </div>
          </DataTable.Toolbar>
          <DataTable.Table />
          <DataTable.Pagination />
        </DataTable>
      </Container>
    </div>
  )
}
