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
import { ArrowPath, Eye, Plus, Trash } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { ActionMenu, PlaceholderCell } from "@modules/common"
import { DraftOrderModal } from "./forms/draft-order-modal"

const columnHelper = createDataTableColumnHelper<VendorDraftOrder>()
const filterHelper = createDataTableFilterHelper<VendorDraftOrder>()

const filters = [
  filterHelper.custom({
    id: "created_at_gte",
    label: "Date Created",
    type: "select",
    options: [
      { label: "Last 7 days", value: "7d" },
      { label: "Last 30 days", value: "30d" },
      { label: "Last 90 days", value: "90d" },
    ],
  }),
  filterHelper.custom({
    id: "currency_code",
    label: "Currency",
    type: "select",
    options: [
      { label: "USD ($)", value: "usd" },
      { label: "EUR (€)", value: "eur" },
      { label: "GBP (£)", value: "gbp" },
      { label: "CAD ($)", value: "cad" },
      { label: "AUD ($)", value: "aud" },
      { label: "INR (₹)", value: "inr" },
    ],
  }),
]

const extractFilterVal = (val: any): string | undefined => {
  if (!val) return undefined
  if (typeof val === "string") return val
  if (Array.isArray(val)) return val[0]
  if (typeof val === "object") {
    const flat = Object.values(val).flat()
    return (flat[0] as string) || undefined
  }
  return undefined
}

export const DraftOrdersTable = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [search, setSearch] = useState("")
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)
  const [filtering, setFiltering] = useState<DataTableFilteringState>({})
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

  const dateFilterVal = extractFilterVal(filtering.created_at_gte)
  const createdAtGte = useMemo(() => {
    if (!dateFilterVal) return undefined
    const days = dateFilterVal === "7d" ? 7 : dateFilterVal === "30d" ? 30 : 90
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  }, [dateFilterVal])

  const currencyCode = extractFilterVal(filtering.currency_code)

  const { data, isLoading } = useQuery({
    queryKey: [
      "vendor-draft-orders",
      { limit, offset, q: search, order, created_at_gte: createdAtGte, currency_code: currencyCode },
    ],
    queryFn: () =>
      listVendorDraftOrders({
        limit,
        offset,
        q: search || undefined,
        order,
        created_at_gte: createdAtGte,
        currency_code: currencyCode,
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
    filtering: {
      state: filtering,
      onFilteringChange: (value) => {
        setFiltering(value)
        setPagination((state) => ({ ...state, pageIndex: 0 }))
      },
    },
    filters,
    search: {
      state: search,
      onSearchChange: (value) => {
        setSearch(value)
        setPagination((state) => ({ ...state, pageIndex: 0 }))
      },
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
          <div className="flex items-center gap-x-2">
            <DataTable.FilterMenu tooltip="Filter" />
            <DataTable.SortingMenu tooltip="Sort" />
          </div>
        </DataTable.Toolbar>
        <DataTable.FilterBar />

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
