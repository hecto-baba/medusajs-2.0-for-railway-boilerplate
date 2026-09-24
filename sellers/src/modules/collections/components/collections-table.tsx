"use client"

import {
  deleteVendorCollection,
  listVendorCollections,
  type VendorCollection,
} from "@lib/data/vendor-client"
import {
  Button,
  createDataTableColumnHelper,
  createDataTableFilterHelper,
  DataTable,
  DataTableDateComparisonOperator,
  DataTableFilteringState,
  DataTablePaginationState,
  DataTableSortingState,
  Heading,
  Text,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { Eye, PencilSquare, Plus, Trash, SquaresPlus } from "@medusajs/icons"
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { ActionMenu, PlaceholderCell } from "@modules/common"
import { CollectionDrawer } from "./forms/collection-drawer"
import { CollectionProductsModal } from "./forms/collection-products-modal"

const columnHelper = createDataTableColumnHelper<VendorCollection>()
const filterHelper = createDataTableFilterHelper<VendorCollection>()

const resolveDateFilter = (val: any): string | undefined => {
  if (!val || val === "all") return undefined
  if (typeof val === "object") {
    if (val.$gte) return typeof val.$gte === "string" ? val.$gte : new Date(val.$gte).toISOString()
    const flat = Object.values(val).flat()
    val = flat[0]
  }
  if (Array.isArray(val)) val = val[0]
  if (typeof val !== "string" || val === "all") return undefined
  const now = new Date()
  if (val === "7d") {
    now.setDate(now.getDate() - 7)
    return now.toISOString()
  }
  if (val === "30d") {
    now.setDate(now.getDate() - 30)
    return now.toISOString()
  }
  if (val === "90d") {
    now.setDate(now.getDate() - 90)
    return now.toISOString()
  }
  if (!isNaN(Date.parse(val))) {
    return new Date(val).toISOString()
  }
  return undefined
}

const dateFilterOptions = [
  {
    label: "Today",
    value: {
      $gte: new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
    },
  },
  {
    label: "Last 7 days",
    value: {
      $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  },
  {
    label: "Last 30 days",
    value: {
      $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  },
  {
    label: "Last 90 days",
    value: {
      $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    },
  },
]

export const CollectionsTable = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [search, setSearch] = useState("")
  const [filtering, setFiltering] = useState<DataTableFilteringState>({})
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)
  const [columnVisibility, setColumnVisibility] = useState<
    Record<string, boolean>
  >({
    updated_at: false,
  })
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  // Drawer & Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingCollection, setEditingCollection] =
    useState<VendorCollection | null>(null)
  const [managingCollection, setManagingCollection] =
    useState<VendorCollection | null>(null)

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const order = sorting
    ? (sorting.desc ? "-" : "") + sorting.id
    : undefined

  const created_at_gte = resolveDateFilter(filtering.created_at)
  const updated_at_gte = resolveDateFilter(filtering.updated_at)

  const { data, isLoading } = useQuery({
    queryKey: [
      "vendor-collections",
      { limit, offset, q: search, order, created_at_gte, updated_at_gte },
    ],
    queryFn: () =>
      listVendorCollections({
        limit,
        offset,
        q: search || undefined,
        created_at_gte,
        updated_at_gte,
        order,
      }),
    placeholderData: keepPreviousData,
  })

  const collections = data?.collections ?? []
  const count = data?.count ?? 0

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVendorCollection(id),
    onSuccess: () => {
      toast.success("Collection deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-collections"] })
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete collection")
    },
  })

  const handleDelete = async (collection: VendorCollection) => {
    const confirmed = await prompt({
      title: "Delete Collection",
      description: `Are you sure you want to delete "${collection.title}"? This cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (confirmed) {
      deleteMutation.mutate(collection.id)
    }
  }

  const filters = useMemo(
    () => [
      filterHelper.accessor("created_at", {
        type: "date",
        label: "Created",
        options: dateFilterOptions,
      }),
      filterHelper.accessor("updated_at", {
        type: "date",
        label: "Updated",
        options: dateFilterOptions,
      }),
    ],
    []
  )

  const columns = useMemo(
    () => [
      columnHelper.accessor("title", {
        header: "Title",
        enableSorting: true,
        sortLabel: "Title",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
        cell: ({ row }) => {
          const col = row.original
          return (
            <Link
              href={`/products/collections/${col.id}`}
              className="flex flex-col group"
            >
              <Text
                size="small"
                weight="plus"
                className="group-hover:text-ui-fg-interactive transition-colors"
              >
                {col.title}
              </Text>
              <Text size="xsmall" className="text-ui-fg-muted font-mono">
                /{col.handle}
              </Text>
            </Link>
          )
        },
      }),
      columnHelper.accessor("handle", {
        header: "Handle",
        enableSorting: true,
        sortLabel: "Handle",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
        cell: ({ getValue }) => (
          <Text size="small" className="text-ui-fg-subtle font-mono">
            {getValue()}
          </Text>
        ),
      }),
      columnHelper.accessor("products_count", {
        header: "Products",
        cell: ({ getValue }) => {
          const val = getValue() ?? 0
          return (
            <Text size="small" className="text-ui-fg-subtle">
              {val} {val === 1 ? "product" : "products"}
            </Text>
          )
        },
      }),
      columnHelper.accessor("created_at", {
        header: "Created",
        enableSorting: true,
        sortLabel: "Created",
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
      columnHelper.accessor("updated_at", {
        header: "Updated",
        enableSorting: true,
        sortLabel: "Updated",
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
          const col = row.original

          return (
            <ActionMenu
              groups={[
                {
                  actions: [
                    {
                      label: "View Details",
                      icon: <Eye className="text-ui-fg-subtle" />,
                      onClick: () =>
                        router.push(`/products/collections/${col.id}`),
                    },
                    {
                      label: "Edit",
                      icon: <PencilSquare className="text-ui-fg-subtle" />,
                      onClick: () => setEditingCollection(col),
                    },
                    {
                      label: "Manage Products",
                      icon: <SquaresPlus className="text-ui-fg-subtle" />,
                      onClick: () => setManagingCollection(col),
                    },
                  ],
                },
                {
                  actions: [
                    {
                      label: "Delete",
                      icon: <Trash className="text-ui-fg-subtle" />,
                      onClick: () => handleDelete(col),
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
    data: collections,
    columns,
    filters,
    filtering: {
      state: filtering,
      onFilteringChange: (val) => {
        setFiltering(val)
        setPagination((p) => ({ ...p, pageIndex: 0 }))
      },
    },
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
      onSearchChange: (value) => {
        setSearch(value)
        setPagination((state) => ({ ...state, pageIndex: 0 }))
      },
    },
    columnVisibility: {
      state: columnVisibility,
      onColumnVisibilityChange: setColumnVisibility,
    },
  })

  return (
    <div className="flex flex-col gap-y-3 p-8">
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h1">Collections</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Group products into collections for promotions, categories, and seasonal curation.
          </Text>
        </div>
        <Button size="small" onClick={() => setIsCreateOpen(true)}>
          <Plus />
          Create Collection
        </Button>
      </div>

      <DataTable instance={table}>
        <DataTable.Toolbar className="flex items-center justify-between">
          <DataTable.Search placeholder="Search collections..." />
          <div className="flex items-center gap-x-2">
            <DataTable.FilterMenu tooltip="Filter" />
            <DataTable.SortingMenu tooltip="Sort" />
          </div>
        </DataTable.Toolbar>
        <DataTable.FilterBar />

        <DataTable.Table />

        <DataTable.Pagination />
      </DataTable>

      {/* Create / Edit Drawer */}
      <CollectionDrawer
        open={isCreateOpen || Boolean(editingCollection)}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false)
            setEditingCollection(null)
          }
        }}
        collection={editingCollection}
      />

      {/* Manage Products Modal */}
      {managingCollection && (
        <CollectionProductsModal
          open={Boolean(managingCollection)}
          onOpenChange={(open) => {
            if (!open) setManagingCollection(null)
          }}
          collectionId={managingCollection.id}
          collectionTitle={managingCollection.title}
          existingProductIds={(managingCollection.products || []).map(
            (p) => p.id
          )}
        />
      )}
    </div>
  )
}
