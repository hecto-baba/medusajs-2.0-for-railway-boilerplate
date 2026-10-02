"use client"

import {
  deleteVendorPriceList,
  listVendorPriceLists,
  type VendorPriceList,
  type VendorPriceListStatus,
  type VendorPriceListType,
} from "@lib/data/vendor-client"
import {
  ActionMenu,
  createMedusaDateFilter,
  resolveMedusaDateFilter,
} from "@modules/common"
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

export const PriceListsTable = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [search, setSearch] = useState("")
  const [filtering, setFiltering] = useState<DataTableFilteringState>({})
  const [sorting, setSorting] = useState<DataTableSortingState | null>({
    id: "title",
    desc: false,
  })
  const [columnVisibility, setColumnVisibility] = useState<
    Record<string, boolean>
  >({
    created_at: false,
    updated_at: false,
  })
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  // Modal / Drawer states
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingPriceList, setEditingPriceList] = useState<VendorPriceList | null>(null)

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const createdAtGte = useMemo(() => {
    return (
      resolveMedusaDateFilter(filtering.created_at) ??
      resolveMedusaDateFilter(filtering.created_at_gte)
    )
  }, [filtering.created_at, filtering.created_at_gte])

  const updatedAtGte = useMemo(() => {
    return (
      resolveMedusaDateFilter(filtering.updated_at) ??
      resolveMedusaDateFilter(filtering.updated_at_gte)
    )
  }, [filtering.updated_at, filtering.updated_at_gte])

  const order = sorting
    ? (sorting.desc ? "-" : "") + sorting.id
    : undefined

  const { data, isLoading } = useQuery({
    queryKey: [
      "vendor-price-lists",
      { limit, offset, q: search, created_at_gte: createdAtGte, updated_at_gte: updatedAtGte, order },
    ],
    queryFn: () =>
      listVendorPriceLists({
        limit,
        offset,
        q: search || undefined,
        created_at_gte: createdAtGte,
        updated_at_gte: updatedAtGte,
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
      createMedusaDateFilter(filterHelper, "created_at", "Created"),
      createMedusaDateFilter(filterHelper, "updated_at", "Updated"),
    ],
    []
  )

  const columns = useMemo(
    () => [
      columnHelper.accessor("title", {
        id: "title",
        header: "Title",
        enableSorting: true,
        sortLabel: "Title",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
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
        id: "status",
        header: "Status",
        enableSorting: true,
        sortLabel: "Status",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
        cell: ({ row }) => {
          const { color, text } = getPriceListStatus(row.original)
          return <StatusBadge color={color}>{text}</StatusBadge>
        },
      }),
      columnHelper.accessor("created_at", {
        id: "created_at",
        header: "Created",
        enableSorting: true,
        sortLabel: "Created",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
        cell: ({ row }) => (
          <Text size="small" className="text-ui-fg-subtle">
            {row.original.created_at
              ? new Date(row.original.created_at).toLocaleDateString()
              : "-"}
          </Text>
        ),
      }),
      columnHelper.accessor("updated_at", {
        id: "updated_at",
        header: "Updated",
        enableSorting: true,
        sortLabel: "Updated",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
        cell: ({ row }) => (
          <Text size="small" className="text-ui-fg-subtle">
            {row.original.updated_at
              ? new Date(row.original.updated_at).toLocaleDateString()
              : "-"}
          </Text>
        ),
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
    columnVisibility: {
      state: columnVisibility,
      onColumnVisibilityChange: setColumnVisibility,
    },
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
            <DataTable.FilterMenu tooltip="Filter" />
            <DataTable.SortingMenu tooltip="Sort" />
          </div>
        </DataTable.Toolbar>
        <DataTable.FilterBar />

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
