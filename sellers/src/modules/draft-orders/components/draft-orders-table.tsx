"use client"

import {
  convertVendorDraftOrder,
  deleteVendorDraftOrder,
  listVendorDraftOrders,
  type VendorDraftOrder,
} from "@lib/data/vendor-client"
import {
  Badge,
  Button,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  DataTableSortingState,
  Heading,
  StatusBadge,
  Text,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { ArrowPath, Eye, Plus, Trash } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { ActionMenu, PlaceholderCell } from "@modules/common"
import { DraftOrderModal } from "./forms/draft-order-modal"

const columnHelper = createDataTableColumnHelper<VendorDraftOrder>()

export const DraftOrdersTable = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [search, setSearch] = useState("")
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const order = sorting
    ? (sorting.desc ? "-" : "") + sorting.id
    : undefined

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-draft-orders", { limit, offset, q: search, order }],
    queryFn: () =>
      listVendorDraftOrders({
        limit,
        offset,
        q: search || undefined,
        order,
      }),
  })

  const draftOrders = data?.draft_orders ?? []
  const count = data?.count ?? 0

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVendorDraftOrder(id),
    onSuccess: () => {
      toast.success("Draft order deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-draft-orders"] })
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete draft order")
    },
  })

  const convertMutation = useMutation({
    mutationFn: (id: string) => convertVendorDraftOrder(id),
    onSuccess: () => {
      toast.success("Draft order converted to live order!")
      queryClient.invalidateQueries({ queryKey: ["vendor-draft-orders"] })
      queryClient.invalidateQueries({ queryKey: ["vendor-orders"] })
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to convert draft order")
    },
  })

  const handleDelete = async (draft: VendorDraftOrder) => {
    const confirmed = await prompt({
      title: "Delete Draft Order",
      description: `Are you sure you want to delete draft order #${draft.display_id}?`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (confirmed) {
      deleteMutation.mutate(draft.id)
    }
  }

  const handleConvert = async (draft: VendorDraftOrder) => {
    const confirmed = await prompt({
      title: "Convert to Order",
      description: `Convert draft order #${draft.display_id} into a regular completed order?`,
      confirmText: "Convert",
      cancelText: "Cancel",
    })

    if (confirmed) {
      convertMutation.mutate(draft.id)
    }
  }

  const columns = useMemo(
    () => [
      columnHelper.accessor("display_id", {
        header: "Order #",
        enableSorting: true,
        cell: ({ row }) => {
          const draft = row.original
          return (
            <Link
              href={`/orders/drafts/${draft.id}`}
              className="text-ui-fg-interactive hover:underline font-semibold text-sm"
            >
              #{draft.display_id}
            </Link>
          )
        },
      }),
      columnHelper.accessor("customer", {
        header: "Customer",
        cell: ({ row }) => {
          const d = row.original
          const customer = d.customer
          const name =
            [customer?.first_name, customer?.last_name]
              .filter(Boolean)
              .join(" ") || d.email || "Guest"
          return (
            <div className="flex flex-col">
              <Text size="small" weight="plus">
                {name}
              </Text>
              {d.email && (
                <Text size="xsmall" className="text-ui-fg-muted">
                  {d.email}
                </Text>
              )}
            </div>
          )
        },
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: () => <StatusBadge color="grey">Draft</StatusBadge>,
      }),
      columnHelper.accessor("items", {
        header: "Items",
        cell: ({ getValue }) => {
          const items = getValue() ?? []
          return (
            <Text size="small" className="text-ui-fg-subtle">
              {items.length} {items.length === 1 ? "item" : "items"}
            </Text>
          )
        },
      }),
      columnHelper.accessor("total", {
        header: "Total",
        enableSorting: true,
        cell: ({ row }) => {
          const d = row.original
          return (
            <Text size="small" weight="plus">
              {(d.currency_code || "USD").toUpperCase()}{" "}
              {(d.total ?? 0).toFixed(2)}
            </Text>
          )
        },
      }),
      columnHelper.accessor("created_at", {
        header: "Date",
        enableSorting: true,
        cell: ({ getValue }) => {
          const date = getValue()
          if (!date) return <PlaceholderCell />
          return (
            <Text size="small" className="text-ui-fg-subtle">
              {new Date(date).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </Text>
          )
        },
      }),
      columnHelper.display({
        id: "actions",
        cell: ({ row }) => {
          const draft = row.original

          return (
            <ActionMenu
              groups={[
                {
                  actions: [
                    {
                      label: "View Details",
                      icon: <Eye className="text-ui-fg-subtle" />,
                      onClick: () =>
                        router.push(`/orders/drafts/${draft.id}`),
                    },
                    {
                      label: "Convert to Order",
                      icon: <ArrowPath className="text-ui-fg-subtle" />,
                      onClick: () => handleConvert(draft),
                    },
                  ],
                },
                {
                  actions: [
                    {
                      label: "Delete",
                      icon: <Trash className="text-ui-fg-subtle" />,
                      onClick: () => handleDelete(draft),
                    },
                  ],
                },
              ]}
            />
          )
        },
      }),
    ],
    []
  )

  const table = useDataTable({
    data: draftOrders,
    columns,
    rowCount: count,
    getRowId: (row) => row.id,
    isLoading,
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
    sorting: {
      state: sorting,
      onSortingChange: setSorting,
    },
    search: {
      state: search,
      onSearchChange: setSearch,
    },
  })

  return (
    <div className="flex flex-col gap-y-3 p-8">
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h1">Draft Orders</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Create and manage custom draft orders for customers before payment and conversion.
          </Text>
        </div>
        <Button size="small" onClick={() => setIsCreateOpen(true)}>
          <Plus />
          Create Draft Order
        </Button>
      </div>

      <DataTable instance={table}>
        <DataTable.Toolbar className="flex items-center justify-between">
          <DataTable.Search placeholder="Search draft orders..." />
        </DataTable.Toolbar>

        <DataTable.Table />

        <DataTable.Pagination />
      </DataTable>

      {/* Create Draft Order Modal */}
      <DraftOrderModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </div>
  )
}
