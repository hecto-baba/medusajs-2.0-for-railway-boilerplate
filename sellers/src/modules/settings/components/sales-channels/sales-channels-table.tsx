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
  Heading,
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
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedChannel, setSelectedChannel] = useState<VendorSalesChannel | null>(null)

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-sales-channels", limit, offset],
    queryFn: () => listVendorSalesChannels({ limit, offset }),
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
  })

  return (
    <Container className="p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex items-center justify-between gap-x-2 px-6 py-4">
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
          >
            <PlusMini />
            Create Channel
          </Button>
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
