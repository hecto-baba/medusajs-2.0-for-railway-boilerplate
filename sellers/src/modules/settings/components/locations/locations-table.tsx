"use client"

import {
  deleteVendorStockLocation,
  listVendorStockLocations,
  type VendorStockLocation,
} from "@lib/data/vendor-client"
import { BuildingStorefront, MapPin, PencilSquare, PlusMini, Trash } from "@medusajs/icons"
import {
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  Heading,
  Text,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { LocationCreateModal } from "./location-create-modal"
import { LocationEditDrawer } from "./location-edit-drawer"
import { ShippingProfilesCard } from "./shipping-profiles-card"
import { ShippingOptionTypesCard } from "./shipping-option-types-card"

const columnHelper = createDataTableColumnHelper<VendorStockLocation>()

export const LocationsTable = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [search, setSearch] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<VendorStockLocation | null>(null)

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-stock-locations", limit, offset, search],
    queryFn: () =>
      listVendorStockLocations({
        limit,
        offset,
        q: search || undefined,
      }),
    placeholderData: (previous) => previous,
  })

  const { mutateAsync: removeLocation } = useMutation({
    mutationFn: (id: string) => deleteVendorStockLocation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-stock-locations"] })
    },
  })

  const handleDelete = async (loc: VendorStockLocation) => {
    const confirmed = await prompt({
      title: "Delete location",
      description: `Are you sure you want to delete "${loc.name}"? This cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (!confirmed) {
      return
    }

    try {
      await removeLocation(loc.id)
      toast.success(`"${loc.name}" was deleted.`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete location."
      )
    }
  }

  const columns = [
    columnHelper.accessor("name", {
      header: "Location",
      cell: ({ row }) => (
        <div
          className="flex items-center gap-x-3 cursor-pointer hover:underline"
          onClick={() => router.push(`/settings/locations/${row.original.id}`)}
        >
          <BuildingStorefront className="text-ui-fg-subtle" />
          <div className="flex flex-col">
            <Text size="small" weight="plus" className="text-ui-fg-base">
              {row.original.name}
            </Text>
          </div>
        </div>
      ),
    }),
    columnHelper.accessor("address", {
      header: "Address",
      cell: ({ row }) => {
        const addr = row.original.address
        if (!addr) {
          return <Text size="small" className="text-ui-fg-subtle">No address configured</Text>
        }
        const parts = [
          addr.address_1,
          addr.city,
          addr.province,
          addr.country_code?.toUpperCase(),
        ].filter(Boolean)

        return (
          <div className="flex items-center gap-x-1 text-ui-fg-subtle">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <Text size="small">{parts.join(", ") || "-"}</Text>
          </div>
        )
      },
    }),
    columnHelper.accessor("created_at", {
      header: "Created",
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
          label: "View Details",
          icon: <BuildingStorefront />,
          onClick: () => router.push(`/settings/locations/${ctx.row.original.id}`),
        },
        {
          label: "Edit",
          icon: <PencilSquare />,
          onClick: () => {
            setSelectedLocation(ctx.row.original)
            setEditOpen(true)
          },
        },
        {
          label: "Delete",
          icon: <Trash />,
          onClick: () => handleDelete(ctx.row.original),
        },
      ],
    }),
  ]

  const table = useDataTable({
    columns,
    data: data?.stock_locations ?? [],
    rowCount: data?.count ?? 0,
    getRowId: (row) => row.id,
    isLoading,
    pagination: { state: pagination, onPaginationChange: setPagination },
    search: { state: search, onSearchChange: setSearch },
  })

  return (
    <div className="flex flex-col gap-y-6">
      <Container className="p-0">
        <DataTable instance={table}>
          <DataTable.Toolbar className="flex items-center justify-between gap-x-2 px-6 py-4">
            <div>
              <Heading level="h2">Locations</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Manage your store stock locations, warehouses, and fulfillment origins.
              </Text>
            </div>
            <div className="flex items-center gap-x-2">
              <DataTable.Search placeholder="Search locations..." />
              <Button
                size="small"
                variant="secondary"
                onClick={() => setCreateOpen(true)}
              >
                <PlusMini />
                Add Location
              </Button>
            </div>
          </DataTable.Toolbar>
          <DataTable.Table />
          <DataTable.Pagination />
        </DataTable>
      </Container>

      <ShippingProfilesCard />

      <ShippingOptionTypesCard />

      <LocationCreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={(newLoc) => router.push(`/settings/locations/${newLoc.id}`)}
      />

      <LocationEditDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        location={selectedLocation}
      />
    </div>
  )
}
