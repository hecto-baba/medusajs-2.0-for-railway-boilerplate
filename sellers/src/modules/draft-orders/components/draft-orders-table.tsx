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
import { ArrowPath, Eye, Plus, Trash } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import {
  ActionMenu,
  PlaceholderCell,
  createMedusaDateFilter,
  resolveMedusaDateFilter,
} from "@modules/common"
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
  const [sorting, setSorting] = useState<DataTableSortingState | null>({
    id: "display_id",
    desc: true,
  })
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

  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    sales_channel: false,
    region: false,
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
      filterHelper.custom({
        id: "sales_channel_id",
        label: "Sales Channel",
        type: "select",
        options: (salesChannelsData?.sales_channels ?? []).map((sc) => ({
          label: sc.name,
          value: sc.id,
        })),
      }),
      filterHelper.custom({
        id: "region_id",
        label: "Region",
        type: "select",
        options: (regionsData?.regions ?? []).map((r) => ({
          label: r.name,
          value: r.id,
        })),
      }),
      createMedusaDateFilter(filterHelper, "created_at", "Created At"),
      createMedusaDateFilter(filterHelper, "updated_at", "Updated At"),
    ]

    return list
  }, [salesChannelsData, regionsData])

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const order = sorting
    ? (sorting.desc ? "-" : "") + sorting.id
    : undefined

  const salesChannelId = extractFilterVal(filtering.sales_channel_id)
  const regionId = extractFilterVal(filtering.region_id)
  const qCustomer = extractFilterVal(filtering.q_customer)

  const createdAtGte = useMemo(
    () => resolveMedusaDateFilter(filtering.created_at),
    [filtering.created_at]
  )

  const updatedAtGte = useMemo(
    () => resolveMedusaDateFilter(filtering.updated_at),
    [filtering.updated_at]
  )

  const { data, isLoading } = useQuery({
    queryKey: [
      "vendor-draft-orders",
      {
        limit,
        offset,
        q: search,
        order,
        created_at_gte: createdAtGte,
        updated_at_gte: updatedAtGte,
        sales_channel_id: salesChannelId,
        region_id: regionId,
        q_customer: qCustomer,
      },
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
        q_customer: qCustomer,
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
        id: "display_id",
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
      columnHelper.accessor("created_at", {
        id: "created_at",
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
      columnHelper.accessor("customer", {
        id: "customer",
        header: "Customer",
        enableSorting: true,
        sortLabel: "Customer",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
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
      columnHelper.accessor("sales_channel" as any, {
        id: "sales_channel",
        header: "Sales Channel",
        enableSorting: true,
        sortLabel: "Sales Channel",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
        cell: ({ row }) => (row.original as any).sales_channel?.name || "-",
      }),
      columnHelper.accessor("region" as any, {
        id: "region",
        header: "Region",
        enableSorting: true,
        sortLabel: "Region",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
        cell: ({ row }) => (row.original as any).region?.name || "-",
      }),
      columnHelper.accessor("status", {
        id: "status",
        header: "Status",
        cell: () => <StatusBadge color="grey">Draft</StatusBadge>,
      }),
      columnHelper.accessor("items", {
        id: "items",
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
        id: "total",
        header: "Total",
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
    columnVisibility: {
      state: columnVisibility,
      onColumnVisibilityChange: setColumnVisibility,
    },
    search: {
      state: search,
      onSearchChange: (value) => {
        setSearch(value)
        setPagination((state) => ({ ...state, pageIndex: 0 }))
      },
    },
  })

  return (
    <Container className="divide-y p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">Draft Orders</Heading>
          <div className="flex items-center gap-x-2">
            <DataTable.Search placeholder="Search draft orders..." />
            <DataTable.FilterMenu tooltip="Filter" />
            <DataTable.SortingMenu tooltip="Sort" />
            <Button
              size="small"
              variant="primary"
              onClick={() => setIsCreateOpen(true)}
            >
              Create
            </Button>
          </div>
        </DataTable.Toolbar>
        <DataTable.FilterBar />

        <DataTable.Table
          emptyState={{
            empty: {
              heading: "No draft orders found",
              description: "Create a new draft order to get started.",
            },
            filtered: {
              heading: "No matches",
              description: "No draft orders match the selected filters or search query.",
            },
          }}
        />

        <DataTable.Pagination />
      </DataTable>

      {/* Create Draft Order Modal */}
      <DraftOrderModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </Container>
  )
}
