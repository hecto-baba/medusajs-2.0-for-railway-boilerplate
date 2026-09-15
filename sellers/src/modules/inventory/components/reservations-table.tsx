"use client"

import {
  deleteVendorReservation,
  getVendorTaxonomy,
  listVendorReservations,
  type VendorReservation,
} from "@lib/data/vendor-client"
import {
  Button,
  Container,
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
import { PencilSquare, Trash } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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

  const locationMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const loc of taxonomy?.stock_locations ?? []) {
      map.set(loc.id, loc.name)
    }
    return map
  }, [taxonomy?.stock_locations])

  const filters = useMemo(
    () => [
      filterHelper.accessor("location_id", {
        label: "Location",
        type: "select",
        options: (taxonomy?.stock_locations ?? []).map((loc) => ({
          label: loc.name,
          value: loc.id,
        })),
      }),
    ],
    [taxonomy?.stock_locations]
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
    const res = await prompt({
      title: "Are you sure?",
      description:
        "You are about to delete a reservation. This action cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel",
    })

    if (!res) return

    try {
      await remove(reservation.id)
      toast.success("Reservation was successfully deleted.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete reservation."
      )
    }
  }

  const reservations = data?.reservations ?? []
  const totalCount = data?.count ?? 0

  const columns = useMemo(
    () => [
      columnHelper.accessor("inventory_item.sku", {
        id: "sku",
        header: "SKU",
        enableSorting: true,
        sortLabel: "SKU",
        cell: ({ row }) => {
          const sku = row.original.inventory_item?.sku
          if (!sku) {
            return <PlaceholderCell />
          }
          return (
            <div className="flex size-full items-center overflow-hidden">
              <span className="truncate">{sku}</span>
            </div>
          )
        },
      }),
      columnHelper.accessor("description", {
        id: "description",
        header: "Description",
        enableSorting: true,
        sortLabel: "Description",
        cell: ({ row }) => {
          const description = row.original.description
          if (!description) {
            return <PlaceholderCell />
          }
          return (
            <div className="flex size-full items-center overflow-hidden">
              <span className="truncate">{description}</span>
            </div>
          )
        },
      }),
      columnHelper.accessor("location_id", {
        id: "location_id",
        header: "Location",
        enableSorting: true,
        sortLabel: "Location",
        cell: ({ row }) => {
          const locName = locationMap.get(row.original.location_id)
          if (!locName) {
            return <PlaceholderCell />
          }
          return (
            <div className="flex size-full items-center overflow-hidden">
              <span className="truncate">{locName}</span>
            </div>
          )
        },
      }),
      columnHelper.accessor("created_at", {
        id: "created_at",
        header: "Created",
        enableSorting: true,
        sortLabel: "Created",
        cell: ({ row }) => {
          const created = row.original.created_at
          if (!created) {
            return <PlaceholderCell />
          }
          return (
            <span className="text-ui-fg-subtle txt-compact-small">
              {new Date(created).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          )
        },
      }),
      columnHelper.accessor("quantity", {
        id: "quantity",
        header: () => (
          <div className="flex size-full items-center justify-end overflow-hidden text-right">
            <span className="truncate">Quantity</span>
          </div>
        ),
        enableSorting: true,
        sortLabel: "Quantity",
        cell: ({ row }) => (
          <div className="flex size-full items-center justify-end overflow-hidden text-right">
            <span className="truncate">{row.original.quantity}</span>
          </div>
        ),
      }),
      columnHelper.action({
        actions: (ctx) => [
          [
            {
              icon: <PencilSquare />,
              label: "Edit",
              onClick: () => setEditingReservation(ctx.row.original),
            },
          ],
          [
            {
              icon: <Trash />,
              label: "Delete",
              onClick: () => handleDelete(ctx.row.original),
            },
          ],
        ],
      }),
    ],
    [locationMap, handleDelete]
  )

  const commands = [
    commandHelper.command({
      label: "Delete",
      shortcut: "d",
      action: async (selection) => {
        const ids = Object.keys(selection)
        const res = await prompt({
          title: "Are you sure?",
          description: `You are about to delete ${ids.length} ${
            ids.length === 1 ? "reservation" : "reservations"
          }. This action cannot be undone.`,
          confirmText: "Delete",
          cancelText: "Cancel",
        })

        if (!res) return

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
    onRowClick: (_event, row) => router.push(`/reservations/${row.id}`),
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
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading>Reservations</Heading>
          <Text className="text-ui-fg-subtle" size="small">
            Manage the reserved quantity of inventory items.
          </Text>
        </div>
        <Button
          size="small"
          variant="secondary"
          onClick={() => setIsCreateOpen(true)}
        >
          Create
        </Button>
      </div>

      <DataTable instance={table}>
        <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-x-2">
            <DataTable.Search placeholder="Search" />
            <DataTable.FilterMenu tooltip="Filter" />
            <DataTable.SortingMenu tooltip="Sort" />
          </div>
        </DataTable.Toolbar>
        <DataTable.FilterBar />
        <DataTable.Table
          emptyState={{
            empty: {
              heading: "No records",
              description: "There are no records to show",
            },
            filtered: {
              heading: "No results",
              description: "Try changing the filters or search query",
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
    </Container>
  )
}
