"use client"

import {
  deleteVendorReservation,
  getVendorTaxonomy,
  listVendorReservations,
  type VendorReservation,
} from "@lib/data/vendor-client"
import {
  Button,
  createDataTableColumnHelper,
  createDataTableCommandHelper,
  createDataTableFilterHelper,
  DataTable,
  DataTableFilteringState,
  DataTablePaginationState,
  DataTableRowSelectionState,
  DataTableSortingState,
  Heading,
  Text,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { PlaceholderCell } from "@modules/common"
import { ReservationDrawer } from "./forms/reservation-drawer"

const columnHelper = createDataTableColumnHelper<VendorReservation>()
const filterHelper = createDataTableFilterHelper<VendorReservation>()
const commandHelper = createDataTableCommandHelper()

export const ReservationsTable = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [search, setSearch] = useState("")
  const [filtering, setFiltering] = useState<DataTableFilteringState>({})
  const [rowSelection, setRowSelection] = useState<DataTableRowSelectionState>({})
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  // Drawer states
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingReservation, setEditingReservation] =
    useState<VendorReservation | null>(null)

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const locationFilter = filtering.location_id as string | undefined

  const order = sorting
    ? (sorting.desc ? "-" : "") + sorting.id
    : undefined

  // Taxonomy for location filter
  const { data: taxonomy } = useQuery({
    queryKey: ["vendor-taxonomy"],
    queryFn: getVendorTaxonomy,
  })

  const locations = taxonomy?.stock_locations ?? []
  const locationMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const loc of locations) {
      map.set(loc.id, loc.name)
    }
    return map
  }, [locations])

  const filters = useMemo(
    () => [
      filterHelper.accessor("location_id", {
        label: "Stock Location",
        type: "select",
        options: locations.map((loc) => ({
          label: loc.name,
          value: loc.id,
        })),
      }),
    ],
    [locations]
  )

  const { data, isLoading } = useQuery({
    queryKey: [
      "vendor-reservations",
      limit,
      offset,
      search,
      locationFilter,
      order,
    ],
    queryFn: () =>
      listVendorReservations({
        limit,
        offset,
        q: search || undefined,
        location_id: locationFilter,
        order,
      }),
    placeholderData: (previous) => previous,
  })

  const { mutateAsync: remove } = useMutation({
    mutationFn: (id: string) => deleteVendorReservation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-reservations"] })
      queryClient.invalidateQueries({ queryKey: ["vendor-inventory-items"] })
    },
  })

  const handleDelete = async (reservation: VendorReservation) => {
    const confirmed = await prompt({
      title: "Delete reservation",
      description: `Are you sure you want to delete and release this reservation of ${reservation.quantity} unit(s)? This cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    })

    if (!confirmed) return

    try {
      await remove(reservation.id)
      toast.success("Reservation deleted and stock released.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete reservation."
      )
    }
  }

  const reservations = data?.reservations ?? []
  const totalCount = data?.count ?? 0

  const totalReservedUnits = reservations.reduce(
    (sum, r) => sum + Number(r.quantity ?? 0),
    0
  )

  const columns = [
    columnHelper.accessor("inventory_item.title", {
      id: "inventory_item",
      header: "Item",
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original.inventory_item
        const itemId = row.original.inventory_item_id

        return (
          <Link
            href={`/inventory/${itemId}`}
            className="flex items-center gap-x-3 py-1 hover:opacity-80 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            {item?.thumbnail ? (
              <img
                src={item.thumbnail}
                alt={item.title || "Item thumbnail"}
                className="h-8 w-8 rounded object-cover border border-ui-border-base"
              />
            ) : (
              <div className="bg-ui-bg-subtle border-ui-border-base text-ui-fg-muted flex h-8 w-8 items-center justify-center rounded border text-xs font-semibold">
                {(item?.title || "I")[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-ui-fg-base txt-compact-small-plus truncate font-medium">
                {item?.title || "Untitled Item"}
              </span>
              {item?.sku ? (
                <span className="text-ui-fg-subtle txt-compact-xsmall font-mono">
                  {item.sku}
                </span>
              ) : null}
            </div>
          </Link>
        )
      },
    }),
    columnHelper.accessor("description", {
      id: "description",
      header: "Description / Reference",
      enableSorting: true,
      sortLabel: "Description",
      cell: ({ row }) =>
        row.original.description ? (
          <span className="text-ui-fg-subtle txt-compact-small line-clamp-1">
            {row.original.description}
          </span>
        ) : (
          <PlaceholderCell />
        ),
    }),
    columnHelper.accessor("location_id", {
      id: "location_id",
      header: "Location",
      enableSorting: true,
      sortLabel: "Location",
      cell: ({ row }) => {
        const locName = locationMap.get(row.original.location_id) || "Stock Location"
        return (
          <span className="text-ui-fg-subtle txt-compact-small font-medium">
            {locName}
          </span>
        )
      },
    }),
    columnHelper.accessor("quantity", {
      id: "quantity",
      header: "Quantity",
      enableSorting: true,
      sortLabel: "Quantity",
      cell: ({ row }) => (
        <span className="bg-ui-bg-subtle text-ui-fg-base border-ui-border-base txt-compact-small-plus rounded-md border px-2.5 py-0.5 font-medium">
          {row.original.quantity} units
        </span>
      ),
    }),
    columnHelper.accessor("created_at", {
      id: "created_at",
      header: "Created",
      enableSorting: true,
      sortLabel: "Created",
      cell: ({ row }) => (
        <span className="text-ui-fg-muted txt-compact-xsmall">
          {new Date(row.original.created_at).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </span>
      ),
    }),
    columnHelper.action({
      actions: [
        {
          label: "View inventory item",
          onClick: (ctx) => {
            router.push(`/inventory/${ctx.row.original.inventory_item_id}`)
          },
        },
        {
          label: "Edit reservation",
          onClick: (ctx) => {
            setEditingReservation(ctx.row.original)
          },
        },
        {
          label: "Delete / Release",
          onClick: (ctx) => handleDelete(ctx.row.original),
        },
      ],
    }),
  ]

  const commands = [
    commandHelper.command({
      label: "Delete",
      shortcut: "d",
      action: async (selection) => {
        const ids = Object.keys(selection)
        const confirmed = await prompt({
          title: "Delete reservations",
          description: `Delete and release ${ids.length} ${
            ids.length === 1 ? "reservation" : "reservations"
          }? This cannot be undone.`,
          confirmText: "Delete",
          cancelText: "Cancel",
        })

        if (!confirmed) return

        const failures: string[] = []
        for (const id of ids) {
          try {
            await deleteVendorReservation(id)
          } catch {
            failures.push(id)
          }
        }

        queryClient.invalidateQueries({ queryKey: ["vendor-reservations"] })
        queryClient.invalidateQueries({ queryKey: ["vendor-inventory-items"] })
        setRowSelection({})

        if (failures.length) {
          toast.error(`${failures.length} of ${ids.length} could not be deleted.`)
          return
        }

        toast.success(
          `${ids.length} ${ids.length === 1 ? "reservation" : "reservations"} deleted.`
        )
      },
    }),
  ]

  const table = useDataTable({
    data: reservations,
    columns,
    getRowId: (r) => r.id,
    rowCount: totalCount,
    isLoading,
    search: {
      state: search,
      onSearchChange: (value) => {
        setSearch(value)
        setPagination((state) => ({ ...state, pageIndex: 0 }))
      },
    },
    filtering: {
      state: filtering,
      onFilteringChange: (value) => {
        setFiltering(value)
        setPagination((state) => ({ ...state, pageIndex: 0 }))
      },
    },
    filters,
    commands,
    rowSelection: {
      state: rowSelection,
      onRowSelectionChange: setRowSelection,
    },
    sorting: {
      state: sorting,
      onSortingChange: setSorting,
    },
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
  })

  return (
    <div className="flex flex-col gap-y-4">
      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-ui-bg-base shadow-elevation-card-rest border-ui-border-base rounded-lg border p-4">
          <Text size="xsmall" className="text-ui-fg-subtle uppercase">
            Total Reservations
          </Text>
          <Heading level="h3" className="mt-1">
            {totalCount}
          </Heading>
        </div>
        <div className="bg-ui-bg-base shadow-elevation-card-rest border-ui-border-base rounded-lg border p-4">
          <Text size="xsmall" className="text-ui-fg-subtle uppercase">
            Total Units Reserved
          </Text>
          <Heading level="h3" className="mt-1 text-ui-fg-muted">
            {totalReservedUnits}
          </Heading>
        </div>
      </div>

      <DataTable instance={table}>
        <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading level="h2">Reservations</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Manage inventory holds and order allocations.
            </Text>
          </div>
          <div className="flex items-center gap-x-2">
            <DataTable.Search placeholder="Search reservations..." />
            <DataTable.FilterMenu tooltip="Filter" />
            <DataTable.SortingMenu tooltip="Sort" />
            <Button
              size="small"
              variant="secondary"
              onClick={() => setIsCreateOpen(true)}
            >
              + Create Reservation
            </Button>
          </div>
        </DataTable.Toolbar>
        <DataTable.FilterBar />
        <DataTable.Table
          emptyState={{
            empty: {
              heading: "No reservations yet",
              description: "Create your first reservation to hold stock for an order or customer.",
            },
            filtered: {
              heading: "No matches found",
              description: "Try adjusting your search or filters.",
            },
          }}
        />
        <DataTable.Pagination />
      </DataTable>

      {/* Create Global Reservation Drawer */}
      <ReservationDrawer
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />

      {/* Edit Existing Reservation Drawer */}
      {editingReservation && (
        <ReservationDrawer
          reservation={editingReservation}
          open={!!editingReservation}
          onOpenChange={(open) => {
            if (!open) setEditingReservation(null)
          }}
        />
      )}
    </div>
  )
}
