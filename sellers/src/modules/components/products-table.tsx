"use client"

import {
  deleteVendorProduct,
  listVendorProducts,
  type VendorProduct,
} from "@lib/data/vendor-client"
import {
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  Heading,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import {
  ListSummaryCell,
  PlaceholderCell,
  ProductCell,
  ProductStatusCell,
} from "./table-cells"

const columnHelper = createDataTableColumnHelper<VendorProduct>()

/**
 * Column set and order copied from the admin's useProductTableColumns:
 * Product, Collection, Sales Channel, Variants, Status.
 */
const useColumns = (onDelete: (product: VendorProduct) => void) => [
  columnHelper.display({
    id: "product",
    header: "Product",
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
  columnHelper.display({
    id: "status",
    header: "Status",
    cell: ({ row }) => <ProductStatusCell status={row.original.status} />,
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
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-products", limit, offset, search],
    queryFn: () => listVendorProducts({ limit, offset, q: search || undefined }),
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
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
  })

  return (
    <DataTable instance={table}>
      <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Products</Heading>
        <div className="flex items-center gap-x-2">
          <DataTable.Search placeholder="Search products..." />
          <Link
            href="/products/new"
            className="bg-ui-button-inverted text-ui-contrast-fg-primary shadow-buttons-inverted txt-compact-small-plus rounded-md px-3 py-1.5"
          >
            Create
          </Link>
        </div>
      </DataTable.Toolbar>
      <DataTable.Table
        emptyState={{
          empty: {
            heading: "No products yet",
            description: "Create your first product to start selling.",
          },
          filtered: {
            heading: "No matches",
            description: "No products match that search.",
          },
        }}
      />
      <DataTable.Pagination />
    </DataTable>
  )
}
