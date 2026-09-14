"use client"

import {
  deleteVendorCollection,
  listVendorCollections,
  type VendorCollection,
} from "@lib/data/vendor-client"
import {
  Button,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  DataTableSortingState,
  Heading,
  Text,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { Eye, PencilSquare, Plus, Trash, SquaresPlus } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { ActionMenu, PlaceholderCell } from "@modules/common"
import { CollectionDrawer } from "./forms/collection-drawer"
import { CollectionProductsModal } from "./forms/collection-products-modal"

const columnHelper = createDataTableColumnHelper<VendorCollection>()

export const CollectionsTable = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [search, setSearch] = useState("")
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)
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

  const { data, isLoading } = useQuery({
    queryKey: [
      "vendor-collections",
      { limit, offset, q: search, order },
    ],
    queryFn: () =>
      listVendorCollections({
        limit,
        offset,
        q: search || undefined,
        order,
      }),
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

  const columns = useMemo(
    () => [
      columnHelper.accessor("title", {
        header: "Title",
        enableSorting: true,
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
        </DataTable.Toolbar>

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
