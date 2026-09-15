"use client"

import {
  deleteVendorPriceList,
  listVendorPriceLists,
  type VendorPriceList,
  type VendorPriceListStatus,
  type VendorPriceListType,
} from "@lib/data/vendor-client"
import { ActionMenu } from "@modules/common"
import { PencilSquare, Trash } from "@medusajs/icons"
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
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { PriceListCreateModal } from "./forms/price-list-create-modal"
import { PriceListEditDrawer } from "./forms/price-list-edit-drawer"

export const getPriceListStatus = (priceList: {
  status: string
  starts_at?: string | null
  ends_at?: string | null
}) => {
  const startsAt = priceList.starts_at
  const endsAt = priceList.ends_at

  const isExpired = endsAt ? new Date(endsAt) < new Date() : false
  const isScheduled = startsAt ? new Date(startsAt) > new Date() : false
  const isDraft = priceList.status === "draft"

  if (isDraft) {
    return { color: "grey" as const, text: "Draft", status: "draft" }
  }
  if (isExpired) {
    return { color: "red" as const, text: "Expired", status: "expired" }
  }
  if (isScheduled) {
    return { color: "orange" as const, text: "Scheduled", status: "scheduled" }
  }
  return { color: "green" as const, text: "Active", status: "active" }
}

const columnHelper = createDataTableColumnHelper<VendorPriceList>()
const filterHelper = createDataTableFilterHelper<VendorPriceList>()

export const PriceListsTable = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [search, setSearch] = useState("")
  const [filtering, setFiltering] = useState<DataTableFilteringState>({})
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  // Modal / Drawer states
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingPriceList, setEditingPriceList] = useState<VendorPriceList | null>(null)

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const statusFilter = filtering.status as VendorPriceListStatus | undefined
  const typeFilter = filtering.type as VendorPriceListType | undefined

  const order = sorting
    ? (sorting.desc ? "-" : "") + sorting.id
    : undefined

  const { data, isLoading } = useQuery({
    queryKey: [
      "vendor-price-lists",
      { limit, offset, q: search, status: statusFilter, type: typeFilter, order },
    ],
    queryFn: () =>
      listVendorPriceLists({
        limit,
        offset,
        q: search || undefined,
        status: statusFilter,
        type: typeFilter,
        order,
      }),
  })

  const priceLists = data?.price_lists ?? []
  const count = data?.count ?? 0

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVendorPriceList(id),
    onSuccess: (_, id) => {
      const target = priceLists.find((pl) => pl.id === id)
      toast.success(
        `Price list "${target?.title || "Price list"}" was successfully deleted.`
      )
      queryClient.invalidateQueries({ queryKey: ["vendor-price-lists"] })
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete price list")
    },
  })

  const handleDelete = async (priceList: VendorPriceList) => {
    const confirmed = await prompt({
      title: "Are you sure?",
      description: `You are about to delete the price list "${priceList.title}". This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    })

    if (confirmed) {
      deleteMutation.mutate(priceList.id)
    }
  }

  const filters = useMemo(
    () => [
      filterHelper.accessor("status", {
        type: "select",
        label: "Status",
        options: [
          { label: "Active", value: "active" },
          { label: "Draft", value: "draft" },
        ],
      }),
      filterHelper.accessor("type", {
        type: "select",
        label: "Type",
        options: [
          { label: "Sale", value: "sale" },
          { label: "Override", value: "override" },
        ],
      }),
    ],
    []
  )

  const columns = useMemo(
    () => [
      columnHelper.accessor("title", {
        header: "Title",
        enableSorting: true,
        cell: ({ row }) => {
          const pl = row.original
          return (
            <Link
              href={`/pricing/${pl.id}`}
              className="font-medium text-ui-fg-base hover:text-ui-fg-interactive transition-colors"
            >
              {pl.title}
            </Link>
          )
        },
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: ({ row }) => {
          const { color, text } = getPriceListStatus(row.original)
          return <StatusBadge color={color}>{text}</StatusBadge>
        },
      }),
      columnHelper.display({
        id: "price_overrides",
        header: "Price Overrides",
        cell: ({ row }) => {
          const overrideCount = row.original.prices_count ?? 0
          return (
            <Text size="small" className="text-ui-fg-subtle">
              {overrideCount > 0 ? overrideCount.toString() : "-"}
            </Text>
          )
        },
      }),
      columnHelper.display({
        id: "actions",
        cell: ({ row }) => {
          const priceList = row.original
          return (
            <ActionMenu
              groups={[
                {
                  actions: [
                    {
                      label: "Edit",
                      icon: <PencilSquare />,
                      onClick: () => setEditingPriceList(priceList),
                    },
                  ],
                },
                {
                  actions: [
                    {
                      label: "Delete",
                      icon: <Trash />,
                      onClick: () => handleDelete(priceList),
                    },
                  ],
                },
              ]}
            />
          )
        },
      }),
    ],
    [priceLists]
  )

  const table = useDataTable({
    data: priceLists,
    columns,
    rowCount: count,
    getRowId: (row) => row.id,
    isLoading,
    filters,
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
    search: {
      state: search,
      onSearchChange: setSearch,
    },
    filtering: {
      state: filtering,
      onFilteringChange: setFiltering,
    },
    sorting: {
      state: sorting,
      onSortingChange: setSorting,
    },
  })

  return (
    <Container className="divide-y p-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h1">Price Lists</Heading>
          <Text className="text-ui-fg-subtle" size="small">
            Create sales or override prices for specific conditions.
          </Text>
        </div>
        <Button size="small" variant="secondary" onClick={() => setIsCreateOpen(true)}>
          Create
        </Button>
      </div>

      {/* DataTable */}
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex items-center justify-between">
          <div className="flex items-center gap-x-2">
            <DataTable.Search placeholder="Search price lists..." />
            <DataTable.FilterMenu />
          </div>
        </DataTable.Toolbar>

        <DataTable.Table />

        <DataTable.Pagination />
      </DataTable>

      {/* Create Modal */}
      <PriceListCreateModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={(id) => {
          router.push(`/pricing/${id}`)
        }}
      />

      {/* Edit Drawer */}
      {editingPriceList && (
        <PriceListEditDrawer
          open={!!editingPriceList}
          onOpenChange={(open) => {
            if (!open) setEditingPriceList(null)
          }}
          priceList={editingPriceList}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["vendor-price-lists"] })
          }}
        />
      )}
    </Container>
  )
}
