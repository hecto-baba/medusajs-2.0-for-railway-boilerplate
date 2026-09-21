"use client"

import {
  deleteVendorTaxRegion,
  listVendorTaxRegions,
  type VendorTaxRegion,
} from "@lib/data/vendor-client"
import { PencilSquare, PlusMini, Trash } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  DataTableSortingState,
  Heading,
  Text,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { TaxRegionCreateModal } from "@modules/settings/components/tax-regions/tax-region-create-modal"
import { TaxRegionEditDrawer } from "@modules/settings/components/tax-regions/tax-region-edit-drawer"

const columnHelper = createDataTableColumnHelper<VendorTaxRegion>()

export default function TaxRegionsPage() {
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [search, setSearch] = useState("")
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editRegion, setEditRegion] = useState<VendorTaxRegion | null>(null)

  const order = sorting
    ? (sorting.desc ? "-" : "") + sorting.id
    : undefined

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-tax-regions", { q: search, order }],
    queryFn: () => listVendorTaxRegions({ q: search || undefined, order }),
  })

  const taxRegions = data?.tax_regions ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVendorTaxRegion(id),
    onSuccess: () => {
      toast.success("Tax region removed.")
      queryClient.invalidateQueries({ queryKey: ["vendor-tax-regions"] })
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to remove tax region.")
    },
  })

  const handleDelete = async (region: VendorTaxRegion) => {
    const confirmed = await prompt({
      title: "Remove tax region",
      description: `Are you sure you want to remove the tax region for ${region.country_code}? Default taxes will no longer be calculated for this market.`,
      confirmText: "Remove",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (!confirmed) return

    deleteMutation.mutate(region.id)
  }

  const columns = [
    columnHelper.accessor("country_code", {
      header: "Country",
      enableSorting: true,
      cell: ({ row }) => (
        <div className="flex items-center gap-x-2">
          <Badge size="2xsmall">{row.original.country_code}</Badge>
          <Text size="small" weight="plus" className="text-ui-fg-base">
            {row.original.country_code}
          </Text>
        </div>
      ),
    }),
    columnHelper.accessor("rate", {
      header: "Default Tax Rate",
      enableSorting: true,
      cell: ({ row }) => (
        <div className="flex items-center gap-x-2">
          <Badge size="small" color={row.original.rate !== "Default" ? "blue" : "grey"}>
            {row.original.rate}
          </Badge>
          {row.original.rate_name && (
            <Text size="xsmall" className="text-ui-fg-subtle">
              ({row.original.rate_name})
            </Text>
          )}
        </div>
      ),
    }),
    columnHelper.accessor("rate_code", {
      header: "Tax Code",
      cell: ({ row }) => (
        <Text size="small" className="text-ui-fg-subtle font-mono">
          {row.original.rate_code || "-"}
        </Text>
      ),
    }),
    columnHelper.accessor("created_at", {
      header: "Created",
      enableSorting: true,
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
    columnHelper.action({
      actions: (ctx) => [
        {
          label: "Edit Tax Rate",
          icon: <PencilSquare />,
          onClick: () => setEditRegion(ctx.row.original),
        },
        {
          label: "Remove",
          icon: <Trash />,
          onClick: () => handleDelete(ctx.row.original),
        },
      ],
    }),
  ]

  const table = useDataTable({
    columns,
    data: taxRegions,
    rowCount: taxRegions.length,
    getRowId: (row) => row.id,
    isLoading,
    pagination: { state: pagination, onPaginationChange: setPagination },
    search: { state: search, onSearchChange: setSearch },
    sorting: { state: sorting, onSortingChange: setSorting },
  })

  return (
    <div className="flex flex-col gap-y-4 p-6">
      <Container className="p-0">
        <DataTable instance={table}>
          <DataTable.Toolbar className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-4">
            <div>
              <Heading level="h2">Tax Regions</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Manage tax rates and calculation rules across your sales regions.
              </Text>
            </div>
            <div className="flex items-center gap-x-2 w-full sm:w-auto">
              <DataTable.Search placeholder="Search country code..." />
              <Button
                size="small"
                variant="secondary"
                onClick={() => setIsCreateOpen(true)}
                className="shrink-0"
              >
                <PlusMini /> Create Tax Region
              </Button>
            </div>
          </DataTable.Toolbar>
          <DataTable.Table />
          <DataTable.Pagination />
        </DataTable>
      </Container>

      <TaxRegionCreateModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />

      <TaxRegionEditDrawer
        open={Boolean(editRegion)}
        onOpenChange={(open) => !open && setEditRegion(null)}
        taxRegion={editRegion}
      />
    </div>
  )
}
