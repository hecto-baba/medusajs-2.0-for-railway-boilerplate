"use client"

import {
  convertVendorDraftOrder,
  deleteVendorDraftOrder,
  listVendorDraftOrders,
  listVendorRegions,
  listVendorSalesChannels,
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

  // Fetch filter option data
  const { data: salesChannelsData } = useQuery({
    queryKey: ["vendor-sales-channels-for-draft-filter"],
    queryFn: () => listVendorSalesChannels({ limit: 100, offset: 0 }),
    staleTime: 5 * 60 * 1000,
  })
  const { data: regionsData } = useQuery({
    queryKey: ["vendor-regions-for-draft-filter"],
    queryFn: () => listVendorRegions(),
    staleTime: 5 * 60 * 1000,
  })

  // Dynamic filters matching Backend Production
  const filters = useMemo(() => {
    const list: any[] = [
      filterHelper.custom({
        id: "q_customer",
        label: "Customer",
        type: "select",
        options: [
          { label: "Guest checkout only", value: "guest" },
          { label: "Has customer account", value: "has_customer" },
        ],
      }),
    ]

    const channels = salesChannelsData?.sales_channels ?? []
    if (channels.length > 0) {
      list.push(
        filterHelper.custom({
          id: "sales_channel_id",
          label: "Sales Channel",
          type: "select",
          options: channels.map((sc) => ({ label: sc.name, value: sc.id })),
        })
      )
    }

    const regions = regionsData?.regions ?? []
    if (regions.length > 0) {
      list.push(
        filterHelper.custom({
          id: "region_id",
          label: "Region",
          type: "select",
          options: regions.map((r) => ({ label: r.name, value: r.id })),
        })
      )
    }

    list.push(
      filterHelper.custom({
        id: "created_at_gte",
        label: "Created At",
        type: "select",
        options: [
          { label: "Last 7 days", value: "7d" },
          { label: "Last 30 days", value: "30d" },
          { label: "Last 90 days", value: "90d" },
        ],
      })
    )

    list.push(
      filterHelper.custom({
        id: "updated_at_gte",
        label: "Updated At",
        type: "select",
        options: [
          { label: "Last 7 days", value: "7d" },
          { label: "Last 30 days", value: "30d" },
          { label: "Last 90 days", value: "90d" },
        ],
      })
    )

    return list
  }, [salesChannelsData, regionsData])

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const order = sorting
    ? (sorting.desc ? "-" : "") + sorting.id
    : undefined

  const dateFilterVal = extractFilterVal(filtering.created_at_gte)
  const updatedFilterVal = extractFilterVal(filtering.updated_at_gte)
  const salesChannelId = extractFilterVal(filtering.sales_channel_id)
  const regionId = extractFilterVal(filtering.region_id)

  const createdAtGte = useMemo(() => {
    if (!dateFilterVal) return undefined
    const days = dateFilterVal === "7d" ? 7 : dateFilterVal === "30d" ? 30 : 90
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  }, [dateFilterVal])

  const updatedAtGte = useMemo(() => {
    if (!updatedFilterVal) return undefined
    const days = updatedFilterVal === "7d" ? 7 : updatedFilterVal === "30d" ? 30 : 90
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  }, [updatedFilterVal])

  const { data, isLoading } = useQuery({
    queryKey: [
      "vendor-draft-orders",
      { limit, offset, q: search, order, created_at_gte: createdAtGte, updated_at_gte: updatedAtGte, sales_channel_id: salesChannelId, region_id: regionId },
    ],
    queryFn: () =>
      listVendorDraftOrders({
        limit,
        offset,
        q: search || undefined,
        order,
        created_at_gte: createdAtGte,
        updated_at_gte: updatedAtGte,
        sales_channel_id: salesChannelId,
        region_id: regionId,
      }),
    placeholderData: (previous) => previous,
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
        sortLabel: "Display ID",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
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
        enableSorting: true,
        sortLabel: "Customer",
        sortAscLabel: "A-Z",
        sortDescLabel: "Z-A",
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
        sortLabel: "Date",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
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
