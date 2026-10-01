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
  DataTable,
  DataTablePaginationState,
  DataTableSortingState,
  Heading,
  Select,
  StatusBadge,
  Text,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { SalesChannelDrawer } from "./sales-channel-drawer"

const columnHelper = createDataTableColumnHelper<VendorSalesChannel>()

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
  const [statusFilter, setStatusFilter] = useState<"all" | "enabled" | "disabled">("all")

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedChannel, setSelectedChannel] = useState<VendorSalesChannel | null>(null)

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit
  const order = sorting?.id
    ? sorting.desc
      ? `-${sorting.id}`
      : sorting.id
    : undefined

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-sales-channels", limit, offset, search, order, statusFilter],
    queryFn: () =>
      listVendorSalesChannels({
        limit,
        offset,
        q: search.trim() || undefined,
        order,
        status: statusFilter !== "all" ? statusFilter : undefined,
      }),
    placeholderData: (previous) => previous,
  })

  const { mutateAsync: removeChannel } = useMutation({
    mutationFn: (id: string) => deleteVendorSalesChannel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-sales-channels"] })
    },
  })

  const handleDelete = async (sc: VendorSalesChannel) => {
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
  }

  const columns = [
    columnHelper.accessor("name", {
      header: "Sales Channel",
      enableSorting: true,
      cell: ({ row }) => (
        <div
          className="flex items-center gap-x-3 cursor-pointer hover:underline"
          onClick={() => router.push(`/settings/sales-channels/${row.original.id}`)}
        >
          <Channels className="text-ui-fg-subtle" />
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
    columnHelper.accessor("is_disabled", {
      header: "Status",
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
  ]

  const table = useDataTable({
    columns,
    data: data?.sales_channels ?? [],
    rowCount: data?.count ?? 0,
    getRowId: (row) => row.id,
    isLoading,
    pagination: { state: pagination, onPaginationChange: setPagination },
    search: { state: search, onSearchChange: setSearch },
    sorting: { state: sorting, onSortingChange: setSorting },
  })

  return (
    <Container className="p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-4">
          <div>
            <Heading level="h2">Sales Channels</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Manage where your products are published and sold.
            </Text>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <DataTable.Search placeholder="Search sales channels..." />
            <div className="w-36">
              <Select
                size="small"
                value={statusFilter}
                onValueChange={(val) => setStatusFilter(val as "all" | "enabled" | "disabled")}
              >
                <Select.Trigger>
                  <Select.Value placeholder="Status" />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="all">All Channels</Select.Item>
                  <Select.Item value="enabled">Active</Select.Item>
                  <Select.Item value="disabled">Disabled</Select.Item>
                </Select.Content>
              </Select>
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
        </DataTable.Toolbar>
        <DataTable.Table />
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
