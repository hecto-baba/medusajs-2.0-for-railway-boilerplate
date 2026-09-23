"use client"

import {
  deleteVendorProduct,
  listVendorCollections,
  listVendorProducts,
  listVendorProductTags,
  listVendorProductTypes,
  listVendorSalesChannels,
  type VendorProduct,
} from "@lib/data/vendor-client"
import {
  Button,
  createDataTableColumnHelper,
  createDataTableCommandHelper,
  createDataTableFilterHelper,
  DataTable,
  DataTableFilteringState,
  DataTablePaginationState,
  DataTableRowSelectionState,
  DataTableSortingState,
  Heading,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { Plus } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import {
  ListSummaryCell,
  PlaceholderCell,
  ProductCell,
  ProductStatusCell,
} from "@modules/common"
import { ProductExportButton } from "./product-export-button"
import { ProductImportModal } from "./product-import-modal"
import { AddProductModal } from "./add-product-modal"

const columnHelper = createDataTableColumnHelper<VendorProduct>()
const filterHelper = createDataTableFilterHelper<VendorProduct>()
const commandHelper = createDataTableCommandHelper()

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

/**
 * Column set and order copied from the admin's useProductTableColumns:
 * Product, Collection, Sales Channel, Variants, Status.
 */
const useColumns = (onDelete: (product: VendorProduct) => void) => [
  columnHelper.accessor("title", {
    id: "title",
    header: "Product",
    enableSorting: true,
    sortLabel: "Title",
    sortAscLabel: "A-Z",
    sortDescLabel: "Z-A",
    cell: ({ row }) => (
      <ProductCell
        thumbnail={row.original.thumbnail}
        title={row.original.title}
      />
    ),
  }),
  columnHelper.display({
    id: "collection",
    header: "Collection",
    cell: ({ row }) =>
      row.original.collection?.title ? (
        <span className="truncate">{row.original.collection.title}</span>
      ) : (
        <PlaceholderCell />
      ),
  }),
  columnHelper.display({
    id: "sales_channels",
    header: "Sales Channel",
    cell: ({ row }) => (
      <ListSummaryCell
        items={(row.original.sales_channels ?? []).map((c) => c.name ?? "")}
        inlineLabel="channels"
      />
    ),
  }),
  columnHelper.display({
    id: "variants",
    header: "Variants",
    cell: ({ row }) => {
      const count = row.original.variants?.length ?? 0
      return count ? `${count}` : <PlaceholderCell />
    },
  }),
  columnHelper.accessor("status", {
    id: "status",
    header: "Status",
    enableSorting: true,
    sortLabel: "Status",
    cell: ({ row }) => <ProductStatusCell status={row.original.status} />,
  }),
  columnHelper.accessor("created_at", {
    id: "created_at",
    header: "Created",
    enableSorting: true,
    sortLabel: "Created",
    sortAscLabel: "Oldest first",
    sortDescLabel: "Newest first",
    cell: ({ row }) =>
      new Date(row.original.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
  }),
  columnHelper.action({
    actions: [
      {
        label: "Edit",
        // Rendered as a link rather than a router push so the row action
        // behaves like a link: middle-click and open-in-new-tab both work.
        onClick: (ctx) => {
          window.location.href = `/products/${ctx.row.original.id}`
        },
      },
      {
        label: "Delete",
        onClick: (ctx) => onDelete(ctx.row.original),
      },
    ],
  }),
]

export const ProductsTable = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [search, setSearch] = useState("")
  const [filtering, setFiltering] = useState<DataTableFilteringState>({})
  const [rowSelection, setRowSelection] = useState<DataTableRowSelectionState>(
    {}
  )
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false)

  // Fetch filter options
  const { data: collectionsData } = useQuery({
    queryKey: ["vendor-collections-filter"],
    queryFn: () => listVendorCollections({ limit: 100, offset: 0 }),
  })
  const { data: typesData } = useQuery({
    queryKey: ["vendor-types-filter"],
    queryFn: () => listVendorProductTypes({ limit: 100, offset: 0 }),
  })
  const { data: tagsData } = useQuery({
    queryKey: ["vendor-tags-filter"],
    queryFn: () => listVendorProductTags({ limit: 100, offset: 0 }),
  })
  const { data: salesChannelsData } = useQuery({
    queryKey: ["vendor-channels-filter"],
    queryFn: () => listVendorSalesChannels({ limit: 100, offset: 0 }),
  })

  // Dynamic filter definitions
  const filters = useMemo(() => {
    const list: any[] = [
      filterHelper.accessor("status", {
        label: "Status",
        type: "multiselect",
        options: [
          { label: "Draft", value: "draft" },
          { label: "Proposed", value: "proposed" },
          { label: "Published", value: "published" },
          { label: "Rejected", value: "rejected" },
        ],
      }),
    ]

    const collections = collectionsData?.collections ?? []
    if (collections.length > 0) {
      list.push(
        filterHelper.custom({
          id: "collection_id",
          label: "Collection",
          type: "select",
          options: collections.map((c) => ({
            label: c.title,
            value: c.id,
          })),
        })
      )
    }

    const types = typesData?.product_types ?? []
    if (types.length > 0) {
      list.push(
        filterHelper.custom({
          id: "type_id",
          label: "Type",
          type: "select",
          options: types.map((t) => ({
            label: t.value,
            value: t.id,
          })),
        })
      )
    }

    const tags = tagsData?.product_tags ?? []
    if (tags.length > 0) {
      list.push(
        filterHelper.custom({
          id: "tag_id",
          label: "Tag",
          type: "select",
          options: tags.map((t) => ({
            label: t.value,
            value: t.id,
          })),
        })
      )
    }

    const channels = salesChannelsData?.sales_channels ?? []
    if (channels.length > 0) {
      list.push(
        filterHelper.custom({
          id: "sales_channel_id",
          label: "Sales Channel",
          type: "select",
          options: channels.map((sc) => ({
            label: sc.name,
            value: sc.id,
          })),
        })
      )
    }

    list.push(
      filterHelper.custom({
        id: "created_at_gte",
        label: "Date Created",
        type: "select",
        options: [
          { label: "Last 7 days", value: "7d" },
          { label: "Last 30 days", value: "30d" },
          { label: "Last 90 days", value: "90d" },
        ],
      })
    )

    return list
  }, [collectionsData, typesData, tagsData, salesChannelsData])

  // A select filter's value arrives either as a bare array or wrapped in an
  // operator object depending on how it was set, so it is normalised here.
  const statusFilter = filtering.status
  const status = Array.isArray(statusFilter)
    ? (statusFilter as string[])
    : statusFilter
      ? (Object.values(statusFilter).flat() as string[])
      : undefined

  const collectionId = extractFilterVal(filtering.collection_id)
  const typeId = extractFilterVal(filtering.type_id)
  const tagId = extractFilterVal(filtering.tag_id)
  const salesChannelId = extractFilterVal(filtering.sales_channel_id)
  const dateFilterVal = extractFilterVal(filtering.created_at_gte)
  const createdAtGte = useMemo(() => {
    if (!dateFilterVal) return undefined
    const days = dateFilterVal === "7d" ? 7 : dateFilterVal === "30d" ? 30 : 90
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  }, [dateFilterVal])

  // The backend reads a leading "-" as descending, matching the admin.
  const order = sorting
    ? (sorting.desc ? "-" : "") + sorting.id
    : undefined

  const { data, isLoading } = useQuery({
    queryKey: [
      "vendor-products",
      limit,
      offset,
      search,
      status,
      order,
      collectionId,
      typeId,
      tagId,
      salesChannelId,
      createdAtGte,
    ],
    queryFn: () =>
      listVendorProducts({
        limit,
        offset,
        q: search || undefined,
        status: status?.length ? status : undefined,
        order,
        collection_id: collectionId,
        type_id: typeId,
        tag_id: tagId,
        sales_channel_id: salesChannelId,
        created_at_gte: createdAtGte,
      }),
    placeholderData: (previous) => previous,
  })

  const { mutateAsync: remove } = useMutation({
    mutationFn: (id: string) => deleteVendorProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-products"] })
    },
  })

  const handleDelete = async (product: VendorProduct) => {
    const confirmed = await prompt({
      title: "Delete product",
      description: `Are you sure you want to delete "${product.title}"? This cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    })

    if (!confirmed) {
      return
    }

    try {
      await remove(product.id)
      toast.success(`"${product.title}" was deleted.`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete the product."
      )
    }
  }

  /**
   * Bulk delete.
   *
   * Deletions run one request at a time rather than through
   * /vendors/products/batch: the batch route is all-or-nothing, so one
   * already-deleted row would fail the whole set. Sequential calls let the
   * rest succeed and report exactly what did not.
   */
  const commands = [
    commandHelper.command({
      label: "Delete",
      shortcut: "d",
      action: async (selection) => {
        const ids = Object.keys(selection)

        const confirmed = await prompt({
          title: "Delete products",
          description:
            "Delete " +
            ids.length +
            (ids.length === 1 ? " product" : " products") +
            "? This cannot be undone.",
          confirmText: "Delete",
          cancelText: "Cancel",
        })

        if (!confirmed) {
          return
        }

        const failures: string[] = []

        for (const id of ids) {
          try {
            await deleteVendorProduct(id)
          } catch {
            failures.push(id)
          }
        }

        queryClient.invalidateQueries({ queryKey: ["vendor-products"] })
        setRowSelection({})

        if (failures.length) {
          toast.error(
            failures.length + " of " + ids.length + " could not be deleted."
          )
          return
        }

        toast.success(
          ids.length + (ids.length === 1 ? " product" : " products") + " deleted."
        )
      },
    }),
  ]

  const table = useDataTable({
    data: data?.products ?? [],
    columns: useColumns(handleDelete),
    getRowId: (product) => product.id,
    rowCount: data?.count ?? 0,
    isLoading,
    onRowClick: (_event, row) => router.push(`/products/${row.id}`),
    search: {
      state: search,
      onSearchChange: (value) => {
        setSearch(value)
        // A narrowed result set can be shorter than the current page, which
        // would otherwise leave the table past the end of it showing nothing.
        setPagination((state) => ({ ...state, pageIndex: 0 }))
      },
    },
    filtering: {
      state: filtering,
      onFilteringChange: (value) => {
        setFiltering(value)
        // A narrowed set can be shorter than the current page, which would
        // leave the table past the end of it showing nothing.
        setPagination((state) => ({ ...state, pageIndex: 0 }))
      },
    },
    filters,
    commands,
    rowSelection: {
      state: rowSelection,
      onRowSelectionChange: setRowSelection,
    },
    sorting: {
      state: sorting,
      onSortingChange: setSorting,
    },
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
  })

  return (
    <>
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">Products</Heading>
          <div className="flex items-center gap-x-2">
            <DataTable.Search placeholder="Search products..." />
            <DataTable.FilterMenu tooltip="Filter" />
            <DataTable.SortingMenu tooltip="Sort" />
            <ProductExportButton />
            <ProductImportModal />
            <Button
              size="small"
              variant="primary"
              onClick={() => setIsAddProductModalOpen(true)}
              className="gap-x-1.5"
            >
              <Plus className="size-4" />
              <span>Add Product</span>
            </Button>
          </div>
        </DataTable.Toolbar>
        <DataTable.FilterBar />
        <DataTable.Table
          emptyState={{
            empty: {
              heading: "No products yet",
              description: "Browse the Master Catalog or create your first custom product.",
            },
            filtered: {
              heading: "No matches",
              description: "No products match that search.",
            },
          }}
        />
        <DataTable.Pagination />
        <DataTable.CommandBar
          selectedLabel={(count) => count + " selected"}
        />
      </DataTable>

      <AddProductModal
        open={isAddProductModalOpen}
        onOpenChange={setIsAddProductModalOpen}
      />
    </>
  )
}
