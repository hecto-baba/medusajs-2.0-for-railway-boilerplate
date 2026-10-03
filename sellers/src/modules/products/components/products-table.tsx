"use client"

import {
  deleteVendorProduct,
  listVendorProducts,
  listVendorProductTags,
  listVendorProductTypes,
  listVendorSalesChannels,
  type ListResponse,
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
import dynamic from "next/dynamic"
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

// Only mounted after "Add Product" is clicked, so keep it (and its drag-and-drop
// dependencies) out of the initial list-page bundle.
const ProductCreateFlow = dynamic(() =>
  import("./product-create-flow").then((m) => m.ProductCreateFlow)
)

// Types, tags and sales channels rarely change while a seller is on this page, so
// the filter menus reuse them for 5 minutes instead of refetching all three lists
// on every visit (the app-wide default is 30s).
const FILTER_OPTIONS_STALE_MS = 5 * 60_000

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
    sortAscLabel: "Ascending",
    sortDescLabel: "Descending",
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
    cell: ({ row }) => <ProductStatusCell status={row.original.status} />,
  }),
  columnHelper.accessor("created_at", {
    id: "created_at",
    header: "Created",
    enableSorting: true,
    sortLabel: "Created",
    sortAscLabel: "Ascending",
    sortDescLabel: "Descending",
    cell: ({ row }) =>
      new Date(row.original.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
  }),
  columnHelper.accessor("updated_at" as any, {
    id: "updated_at",
    header: "Updated",
    enableSorting: true,
    sortLabel: "Updated",
    sortAscLabel: "Ascending",
    sortDescLabel: "Descending",
    cell: ({ row }) => {
      const val = (row.original as any).updated_at
      if (!val) return null
      return new Date(val).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    },
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

export const ProductsTable = ({
  initialData,
}: {
  /** First page (20, unfiltered) read on the server; null falls back to a client fetch. */
  initialData?: ListResponse<{ products: VendorProduct[] }> | null
}) => {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
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

  // Fetch filter options
  const { data: typesData } = useQuery({
    queryKey: ["vendor-types-filter"],
    queryFn: () => listVendorProductTypes({ limit: 100, offset: 0 }),
    staleTime: FILTER_OPTIONS_STALE_MS,
  })
  const { data: tagsData } = useQuery({
    queryKey: ["vendor-tags-filter"],
    queryFn: () => listVendorProductTags({ limit: 100, offset: 0 }),
    staleTime: FILTER_OPTIONS_STALE_MS,
  })
  const { data: salesChannelsData } = useQuery({
    queryKey: ["vendor-channels-filter"],
    queryFn: () => listVendorSalesChannels({ limit: 100, offset: 0 }),
    staleTime: FILTER_OPTIONS_STALE_MS,
  })

  // Dynamic filter definitions
  const filters = useMemo(() => {
    const list: any[] = [
      filterHelper.custom({
        id: "type_id",
        label: "Type",
        type: "select",
        options: (typesData?.product_types ?? []).map((t) => ({
          label: t.value,
          value: t.id,
        })),
      }),
      filterHelper.custom({
        id: "tag_id",
        label: "Tag",
        type: "select",
        options: (tagsData?.product_tags ?? []).map((t) => ({
          label: t.value,
          value: t.id,
        })),
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
        id: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "Draft", value: "draft" },
          { label: "Proposed", value: "proposed" },
          { label: "Published", value: "published" },
          { label: "Rejected", value: "rejected" },
        ],
      }),
      filterHelper.custom({
        id: "created_at_gte",
        label: "Created",
        type: "select",
        options: [
          { label: "Last 7 days", value: "7d" },
          { label: "Last 30 days", value: "30d" },
          { label: "Last 90 days", value: "90d" },
        ],
      }),
      filterHelper.custom({
        id: "updated_at_gte",
        label: "Updated",
        type: "select",
        options: [
          { label: "Last 7 days", value: "7d" },
          { label: "Last 30 days", value: "30d" },
          { label: "Last 90 days", value: "90d" },
        ],
      }),
    ]

    return list
  }, [typesData, tagsData, salesChannelsData])

  // A select filter's value arrives either as a bare array or wrapped in an
  // operator object depending on how it was set, so it is normalised here.
  const statusFilter = filtering.status
  const rawStatus = extractFilterVal(statusFilter)
  const status = Array.isArray(statusFilter)
    ? (statusFilter as string[])
    : rawStatus
      ? [rawStatus]
      : undefined

  const collectionId = extractFilterVal(filtering.collection_id)
  const typeId = extractFilterVal(filtering.type_id)
  const tagId = extractFilterVal(filtering.tag_id)
  const salesChannelId = extractFilterVal(filtering.sales_channel_id)
  const dateFilterVal = extractFilterVal(filtering.created_at_gte)
  const updatedFilterVal = extractFilterVal(filtering.updated_at_gte)
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

  // The backend reads a leading "-" as descending, matching the admin.
  const order = sorting
    ? (sorting.desc ? "-" : "") + sorting.id
    : undefined

  const isOpeningView =
    limit === 20 &&
    offset === 0 &&
    !search &&
    !status?.length &&
    !order &&
    !collectionId &&
    !typeId &&
    !tagId &&
    !salesChannelId &&
    !createdAtGte &&
    !updatedAtGte

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
      updatedAtGte,
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
        updated_at_gte: updatedAtGte,
      }),
    placeholderData: (previous) => previous,
    // The server-rendered page only matches the table's opening view: first
    // page, default size, no search, filters or sort. Any other key fetches.
    initialData: isOpeningView ? initialData ?? undefined : undefined,
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
              className="gap-x-1.5"
              onClick={() => setCreating(true)}
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
              description: "Create your first product to get started.",
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

      {creating ? (
        <ProductCreateFlow open onClose={() => setCreating(false)} />
      ) : null}
    </>
  )
}
