"use client"

import {
  deleteVendorShow,
  listVendorShows,
  type VendorShow,
} from "@lib/data/vendor-client"
import { ActionMenu, PlaceholderCell, Thumbnail } from "@modules/common"
import { ROW_TYPE_STYLES } from "@modules/venues/components/common/seat-chart"
import {
  Buildings,
  Calendar,
  Eye,
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
import { ShowCreateModal } from "./forms/show-create-modal"

const columnHelper = createDataTableColumnHelper<VendorShow>()

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

const formatRun = (dates: string[] = []) => {
  if (!dates.length) return "—"
  const sorted = [...dates].sort()
  const first = formatDate(sorted[0])
  if (sorted.length === 1) return first
  return `${first} – ${formatDate(sorted[sorted.length - 1])}`
}

export const ShowsTable = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [search, setSearch] = useState("")
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const order = sorting
    ? (sorting.desc ? "-" : "") + sorting.id
    : undefined

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-shows", { limit, offset, q: search, order }],
    queryFn: () =>
      listVendorShows({
        limit,
        offset,
        q: search || undefined,
        order,
      }),
  })

  const shows = data?.shows ?? []
  const count = data?.count ?? 0

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVendorShow(id),
    onSuccess: () => {
      toast.success("Show deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-shows"] })
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete show")
    },
  })

  const handleDelete = async (show: VendorShow) => {
    const showTitle = show.product?.title || "this show"
    const confirmed = await prompt({
      title: "Delete Show",
      description: `Are you sure you want to delete "${showTitle}"? All performance dates and seat allocations will be removed.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (confirmed) {
      deleteMutation.mutate(show.id)
    }
  }

  const columns = useMemo(
    () => [
      columnHelper.accessor("product", {
        header: "Show",
        cell: ({ row }) => {
          const show = row.original
          const title = show.product?.title || "Untitled Show"
          return (
            <Link
              href={`/shows/${show.id}`}
              className="flex items-center gap-x-3 group"
            >
              <Thumbnail src={show.product?.thumbnail} />
              <div className="flex flex-col">
                <Text
                  size="small"
                  weight="plus"
                  className="group-hover:text-ui-fg-interactive transition-colors"
                >
                  {title}
                </Text>
                {show.product?.description && (
                  <Text size="xsmall" className="text-ui-fg-subtle line-clamp-1">
                    {show.product.description}
                  </Text>
                )}
              </div>
            </Link>
          )
        },
      }),
      columnHelper.accessor("venue", {
        header: "Venue",
        cell: ({ row }) => {
          const show = row.original
          if (!show.venue) return <PlaceholderCell />
          return (
            <Link
              href={`/venues/${show.venue_id}`}
              className="flex items-center gap-1.5 text-ui-fg-base hover:text-ui-fg-interactive"
            >
              <Buildings className="h-3.5 w-3.5 text-ui-fg-subtle" />
              <Text size="small" className="font-medium">
                {show.venue.name}
              </Text>
            </Link>
          )
        },
      }),
      columnHelper.display({
        id: "run",
        header: "Performance Run",
        cell: ({ row }) => {
          const show = row.original
          return (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-ui-fg-subtle" />
              <Text size="small" className="text-ui-fg-base">
                {formatRun(show.dates)}
              </Text>
            </div>
          )
        },
      }),
      columnHelper.accessor("dates_count", {
        header: "Dates",
        cell: ({ getValue, row }) => {
          const datesCount = getValue() ?? row.original.dates?.length ?? 0
          return (
            <Badge size="small" color="blue">
              {datesCount} {datesCount === 1 ? "date" : "dates"}
            </Badge>
          )
        },
      }),
      columnHelper.accessor("tiers", {
        header: "Tiers",
        cell: ({ getValue, row }) => {
          const tiers =
            getValue() ??
            Array.from(
              new Set((row.original.variants || []).map((v) => v.row_type))
            )

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
      columnHelper.accessor("venue_capacity", {
        header: "Capacity",
        cell: ({ getValue, row }) => {
          const cap =
            getValue() ??
            (row.original.venue?.rows || []).reduce(
              (acc, r) => acc + (r.seat_count || 0),
              0
            )

          return (
            <Text size="small" weight="plus" className="text-ui-fg-base">
              {cap} seats / show
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
          const show = row.original
          return (
            <ActionMenu
              groups={[
                {
                  actions: [
                    {
                      label: "View Show & Seat Map",
                      icon: <Eye className="h-4 w-4" />,
                      onClick: () => router.push(`/shows/${show.id}`),
                    },
                    {
                      label: "Delete Show",
                      icon: <Trash className="h-4 w-4 text-ui-fg-error" />,
                      onClick: () => handleDelete(show),
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
    data: shows,
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
          <Heading level="h1">Shows</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Events sold as tickets, with stage seating plans and performance runs.
          </Text>
        </div>
        <Button size="small" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Create Show
        </Button>
      </div>

      {/* Medusa DataTable */}
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex items-center justify-between">
          <div className="flex items-center gap-x-2">
            <DataTable.Search placeholder="Search shows..." />
          </div>
        </DataTable.Toolbar>

        <DataTable.Table />

        <DataTable.Pagination />
      </DataTable>

      {/* Create Modal */}
      <ShowCreateModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["vendor-shows"] })
        }}
      />
    </div>
  )
}
