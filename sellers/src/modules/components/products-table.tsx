"use client"

import { listVendorProducts, type VendorProduct } from "@lib/data/vendor-client"
import {
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  Heading,
  StatusBadge,
  useDataTable,
} from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"

const columnHelper = createDataTableColumnHelper<VendorProduct>()

const columns = [
  columnHelper.display({
    id: "thumbnail",
    header: "",
    cell: ({ row }) =>
      row.original.thumbnail ? (
        // Plain img rather than next/image: the thumbnail host varies with the
        // configured file provider, and next/image would need every one of
        // them declared in next.config.js up front.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.original.thumbnail}
          alt=""
          className="h-8 w-8 rounded object-cover"
        />
      ) : (
        <div className="bg-ui-bg-component h-8 w-8 rounded" />
      ),
  }),
  columnHelper.accessor("title", { header: "Title" }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: ({ getValue }) => {
      const status = getValue()
      return (
        <StatusBadge color={status === "published" ? "green" : "grey"}>
          {status.replace(/\b\w/g, (c) => c.toUpperCase())}
        </StatusBadge>
      )
    },
  }),
  columnHelper.display({
    id: "variants",
    header: "Variants",
    cell: ({ row }) => row.original.variants?.length ?? 0,
  }),
  columnHelper.accessor("created_at", {
    header: "Created",
    cell: ({ getValue }) =>
      new Date(getValue()).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
  }),
]

export const ProductsTable = () => {
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

  const table = useDataTable({
    data: data?.products ?? [],
    columns,
    getRowId: (product) => product.id,
    rowCount: data?.count ?? 0,
    isLoading,
    search: {
      state: search,
      onSearchChange: (value) => {
        setSearch(value)
        // A narrowed result set can be shorter than the current page, which
        // would otherwise leave the table sitting past the end of it showing
        // nothing.
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
        <DataTable.Search placeholder="Search products..." />
      </DataTable.Toolbar>
      <DataTable.Table
        emptyState={{
          empty: {
            heading: "No products yet",
            description: "Products you add will appear here.",
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
