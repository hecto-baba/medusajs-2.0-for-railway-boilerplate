"use client"

import {
  deleteVendorVenue,
  listVendorVenues,
  type VendorVenue,
} from "@lib/data/vendor-client"
import { ActionMenu, PlaceholderCell } from "@modules/common"
import {
  Buildings,
  Eye,
  PencilSquare,
  Plus,
  Trash,
} from "@medusajs/icons"
import {
  Badge,
  Button,
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
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { ROW_TYPE_STYLES } from "./common/seat-chart"
import { VenueCreateModal } from "./forms/venue-create-modal"
import { VenueEditDrawer } from "./forms/venue-edit-drawer"

const columnHelper = createDataTableColumnHelper<VendorVenue>()

export const VenuesTable = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [search, setSearch] = useState("")
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  // Modal / Drawer states
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingVenue, setEditingVenue] = useState<VendorVenue | null>(null)

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const order = sorting
    ? (sorting.desc ? "-" : "") + sorting.id
    : undefined

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-venues", { limit, offset, q: search, order }],
    queryFn: () =>
      listVendorVenues({
        limit,
        offset,
        q: search || undefined,
        order,
      }),
  })

  const venues = data?.venues ?? []
  const count = data?.count ?? 0

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVendorVenue(id),
    onSuccess: () => {
      toast.success("Venue deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-venues"] })
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete venue")
    },
  })

  const handleDelete = async (venue: VendorVenue) => {
    const confirmed = await prompt({
      title: "Delete Venue",
      description: `Are you sure you want to delete "${venue.name}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (confirmed) {
      deleteMutation.mutate(venue.id)
    }
  }

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Venue",
        enableSorting: true,
        cell: ({ row }) => {
          const venue = row.original
          return (
            <Link
              href={`/venues/${venue.id}`}
              className="flex items-center gap-x-3 group"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded bg-ui-bg-subtle text-ui-fg-subtle group-hover:text-ui-fg-base group-hover:bg-ui-bg-subtle-hover transition-colors">
                <Buildings className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <Text
                  size="small"
                  weight="plus"
                  className="group-hover:text-ui-fg-interactive transition-colors"
                >
                  {venue.name}
                </Text>
                {venue.address && (
                  <Text size="xsmall" className="text-ui-fg-subtle line-clamp-1">
                    {venue.address}
                  </Text>
                )}
              </div>
            </Link>
          )
        },
      }),
      columnHelper.accessor("address", {
        header: "Location",
        cell: ({ getValue }) => {
          const addr = getValue()
          return addr ? (
            <Text size="small" className="text-ui-fg-subtle">
              {addr}
            </Text>
          ) : (
            <PlaceholderCell />
          )
        },
      }),
      columnHelper.accessor("rows_count", {
        header: "Rows",
        cell: ({ getValue, row }) => {
          const rowsCount = getValue() ?? row.original.rows?.length ?? 0
          return (
            <Badge size="small" color="grey">
              {rowsCount} {rowsCount === 1 ? "row" : "rows"}
            </Badge>
          )
        },
      }),
      columnHelper.accessor("tiers", {
        header: "Seating Tiers",
        cell: ({ getValue, row }) => {
          const tiers =
            getValue() ??
            Array.from(new Set((row.original.rows || []).map((r) => r.row_type)))

          if (!tiers.length) return <PlaceholderCell />

          return (
            <div className="flex flex-wrap gap-1">
              {tiers.map((t) => {
                const style = ROW_TYPE_STYLES[t] ?? ROW_TYPE_STYLES.standard
                return (
                  <Badge key={t} size="small" color={style.badgeColor}>
                    {style.label}
                  </Badge>
                )
              })}
            </div>
          )
        },
      }),
      columnHelper.accessor("total_seats", {
        header: "Total Capacity",
        cell: ({ getValue, row }) => {
          const total =
            getValue() ??
            (row.original.rows || []).reduce(
              (acc, r) => acc + (r.seat_count || 0),
              0
            )

          return (
            <Text size="small" weight="plus" className="text-ui-fg-base">
              {total} seats
            </Text>
          )
        },
      }),
      columnHelper.accessor("created_at", {
        header: "Created",
        enableSorting: true,
        cell: ({ getValue }) => {
          const date = getValue()
          return (
            <Text size="small" className="text-ui-fg-subtle">
              {date ? new Date(date).toLocaleDateString() : "-"}
            </Text>
          )
        },
      }),
      columnHelper.display({
        id: "actions",
        cell: ({ row }) => {
          const venue = row.original
          return (
            <ActionMenu
              groups={[
                {
                  actions: [
                    {
                      label: "View Venue",
                      icon: <Eye className="h-4 w-4" />,
                      onClick: () => router.push(`/venues/${venue.id}`),
                    },
                    {
                      label: "Edit Details",
                      icon: <PencilSquare className="h-4 w-4" />,
                      onClick: () => setEditingVenue(venue),
                    },
                    {
                      label: "Delete",
                      icon: <Trash className="h-4 w-4 text-ui-fg-error" />,
                      onClick: () => handleDelete(venue),
                    },
                  ],
                },
              ]}
            />
          )
        },
      }),
    ],
    [router]
  )

  const table = useDataTable({
    data: venues,
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
    sorting: {
      state: sorting,
      onSortingChange: setSorting,
    },
  })

  return (
    <div className="flex flex-col gap-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h1">Venues</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Manage performance locations, seating plans, and seating tiers for your ticketed shows.
          </Text>
        </div>
        <Button size="small" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Create Venue
        </Button>
      </div>

      {/* Medusa DataTable */}
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex items-center justify-between">
          <div className="flex items-center gap-x-2">
            <DataTable.Search placeholder="Search venues..." />
          </div>
        </DataTable.Toolbar>

        <DataTable.Table />

        <DataTable.Pagination />
      </DataTable>

      {/* Create Modal */}
      <VenueCreateModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["vendor-venues"] })
        }}
      />

      {/* Edit Drawer */}
      {editingVenue && (
        <VenueEditDrawer
          open={!!editingVenue}
          onOpenChange={(open) => {
            if (!open) setEditingVenue(null)
          }}
          venue={editingVenue}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["vendor-venues"] })
          }}
        />
      )}
    </div>
  )
}
