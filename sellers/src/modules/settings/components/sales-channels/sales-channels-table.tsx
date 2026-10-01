"use client"

import {
  deleteVendorSalesChannel,
  listVendorSalesChannels,
  type VendorSalesChannel,
} from "@lib/data/vendor-client"
import { Channels, PencilSquare, PlusMini, Trash } from "@medusajs/icons"
import {
  Button,
  Container,
  createDataTableColumnHelper,
  createDataTableFilterHelper,
  DataTable,
  DataTableFilteringState,
  DataTablePaginationState,
  DataTableSortingState,
  Heading,
  StatusBadge,
  Text,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { SalesChannelDrawer } from "./sales-channel-drawer"

const columnHelper = createDataTableColumnHelper<VendorSalesChannel>()
const filterHelper = createDataTableFilterHelper<VendorSalesChannel>()

const extractFilterValue = (val: any): string | undefined => {
  if (!val) return undefined
  if (typeof val === "string") return val
  if (Array.isArray(val)) return val[0]
  if (typeof val === "object") {
    const flat = Object.values(val).flat()
    return (flat[0] as string) || undefined
  }
  return undefined
}

const filters = [
  filterHelper.custom({
    id: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Enabled", value: "enabled" },
      { label: "Disabled", value: "disabled" },
    ],
  }),
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

export const SalesChannelsTable = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [search, setSearch] = useState("")
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)
  const [filtering, setFiltering] = useState<DataTableFilteringState>({})

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedChannel, setSelectedChannel] = useState<VendorSalesChannel | null>(null)

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit
  const order = sorting
    ? (sorting.desc ? "-" : "") + sorting.id
    : undefined

  const statusVal = extractFilterValue(filtering.status)
  const createdVal = extractFilterValue(filtering.created_at)
  const updatedVal = extractFilterValue(filtering.updated_at)

  const createdAtGte = useMemo(() => {
    if (!createdVal) return undefined
    const days = createdVal === "7d" ? 7 : createdVal === "30d" ? 30 : 90
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  }, [createdVal])

  const updatedAtGte = useMemo(() => {
    if (!updatedVal) return undefined
    const days = updatedVal === "7d" ? 7 : updatedVal === "30d" ? 30 : 90
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  }, [updatedVal])

  const { data, isLoading } = useQuery({
    queryKey: [
      "vendor-sales-channels",
      limit,
      offset,
      search,
      order,
      statusVal,
      createdAtGte,
      updatedAtGte,
    ],
    queryFn: () =>
      listVendorSalesChannels({
        limit,
        offset,
        q: search.trim() || undefined,
        order,
        status: statusVal,
        created_at_gte: createdAtGte,
        updated_at_gte: updatedAtGte,
      }),
    placeholderData: (previous) => previous,
  })

  const { mutateAsync: removeChannel } = useMutation({
    mutationFn: (id: string) => deleteVendorSalesChannel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-sales-channels"] })
    },
  })

  const handleDelete = useCallback(
    async (sc: VendorSalesChannel) => {
      const confirmed = await prompt({
        title: "Delete sales channel",
        description: `Are you sure you want to delete "${sc.name}"? Products attached to this channel will remain intact.`,
        confirmText: "Delete",
        cancelText: "Cancel",
        variant: "danger",
      })

      if (!confirmed) {
        return
      }

      try {
        await removeChannel(sc.id)
        toast.success(`"${sc.name}" was deleted.`)
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not delete sales channel."
        )
      }
    },
    [prompt, removeChannel]
  )

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        id: "name",
        header: "Name",
        enableSorting: true,
        sortLabel: "Name",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
        cell: ({ row }) => (
          <div
            className="flex items-center gap-x-3 cursor-pointer hover:underline"
            onClick={() => router.push(`/settings/sales-channels/${row.original.id}`)}
          >
            <Channels className="text-ui-fg-subtle shrink-0" />
            <div className="flex flex-col">
              <Text size="small" weight="plus" className="text-ui-fg-base">
                {row.original.name}
              </Text>
              {row.original.description && (
                <Text size="xsmall" className="text-ui-fg-subtle line-clamp-1">
                  {row.original.description}
                </Text>
              )}
            </div>
          </div>
        ),
      }),
      columnHelper.accessor("description", {
        id: "description",
        header: "Description",
        enableSorting: true,
        sortLabel: "Description",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
        cell: ({ row }) => (
          <Text size="small" className="text-ui-fg-subtle line-clamp-1">
            {row.original.description || "-"}
          </Text>
        ),
      }),
      columnHelper.accessor("is_disabled", {
        id: "is_disabled",
        header: "Status",
        enableSorting: true,
        sortLabel: "Status",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
        cell: ({ row }) => {
          const disabled = row.original.is_disabled
          return (
            <StatusBadge color={disabled ? "grey" : "green"}>
              {disabled ? "Disabled" : "Active"}
            </StatusBadge>
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
      columnHelper.action({
        actions: (ctx) => [
          {
            label: "View Details",
            icon: <Channels />,
            onClick: () => router.push(`/settings/sales-channels/${ctx.row.original.id}`),
          },
          {
            label: "Edit",
            icon: <PencilSquare />,
            onClick: () => {
              setSelectedChannel(ctx.row.original)
              setDrawerOpen(true)
            },
          },
          {
            label: "Delete",
            icon: <Trash />,
            onClick: () => handleDelete(ctx.row.original),
          },
        ],
      }),
    ],
    [handleDelete, router]
  )

  const table = useDataTable({
    columns,
    data: data?.sales_channels ?? [],
    rowCount: data?.count ?? 0,
    getRowId: (row) => row.id,
    isLoading,
    pagination: { state: pagination, onPaginationChange: setPagination },
    filtering: { state: filtering, onFilteringChange: setFiltering },
    sorting: { state: sorting, onSortingChange: setSorting },
    search: { state: search, onSearchChange: setSearch },
    filters,
  })

  return (
    <Container className="p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex flex-col gap-y-3 px-6 py-4">
          <div className="flex items-center justify-between gap-x-2">
            <div>
              <Heading level="h2">Sales Channels</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Manage where your products are published and sold.
              </Text>
            </div>
            <Button
              size="small"
              variant="secondary"
              onClick={() => {
                setSelectedChannel(null)
                setDrawerOpen(true)
              }}
              className="shrink-0"
            >
              <PlusMini />
              Create Channel
            </Button>
          </div>

          <div className="flex items-center justify-end gap-x-2 border-b pb-3">
            <DataTable.Search placeholder="Search sales channels..." />
            <DataTable.FilterMenu tooltip="Filter" />
            <DataTable.SortingMenu tooltip="Sort" />
          </div>
        </DataTable.Toolbar>

        <DataTable.FilterBar />

        <DataTable.Table
          emptyState={{
            empty: {
              heading: "No sales channels",
              description: "Create a sales channel to get started.",
            },
            filtered: {
              heading: "No results found",
              description: "Try changing your search or filter options.",
            },
          }}
        />

        <DataTable.Pagination />
      </DataTable>

      <SalesChannelDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        salesChannel={selectedChannel}
      />
    </Container>
  )
}
