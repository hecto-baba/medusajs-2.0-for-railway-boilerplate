"use client"

import {
  deleteVendorProductOption,
  listVendorProductOptions,
  type VendorProductOptionItem,
} from "@lib/data/vendor-client"
import {
  Badge,
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
import { Eye, PencilSquare, Plus, Trash } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { ActionMenu, PlaceholderCell } from "@modules/common"
import { ProductOptionDrawer } from "./forms/product-option-drawer"

const columnHelper = createDataTableColumnHelper<VendorProductOptionItem>()

export const ProductOptionsTable = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [search, setSearch] = useState("")
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  // Drawer states
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingOption, setEditingOption] =
    useState<VendorProductOptionItem | null>(null)

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const order = sorting
    ? (sorting.desc ? "-" : "") + sorting.id
    : undefined

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-product-options", { limit, offset, q: search, order }],
    queryFn: () =>
      listVendorProductOptions({
        limit,
        offset,
        q: search || undefined,
        order,
      }),
  })

  const options = data?.product_options ?? []
  const count = data?.count ?? 0

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVendorProductOption(id),
    onSuccess: () => {
      toast.success("Product option deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-product-options"] })
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete product option")
    },
  })

  const handleDelete = async (opt: VendorProductOptionItem) => {
    const confirmed = await prompt({
      title: "Delete Product Option",
      description: `Are you sure you want to delete "${opt.title}"? This cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (confirmed) {
      deleteMutation.mutate(opt.id)
    }
  }

  const columns = useMemo(
    () => [
      columnHelper.accessor("title", {
        header: "Option Title",
        enableSorting: true,
        cell: ({ row }) => {
          const opt = row.original
          return (
            <Link
              href={`/products/options/${opt.id}`}
              className="flex flex-col group"
            >
              <Text
                size="small"
                weight="plus"
                className="group-hover:text-ui-fg-interactive transition-colors"
              >
                {opt.title}
              </Text>
            </Link>
          )
        },
      }),
      columnHelper.accessor("product", {
        header: "Associated Product",
        cell: ({ row }) => {
          const product = row.original.product
          if (!product) {
            return (
              <Badge color="grey" size="small">
                Global / Unlinked
              </Badge>
            )
          }
          return (
            <Link
              href={`/products/${product.id}`}
              className="text-ui-fg-interactive hover:underline font-medium text-sm"
            >
              {product.title}
            </Link>
          )
        },
      }),
      columnHelper.accessor("values", {
        header: "Values",
        cell: ({ getValue }) => {
          const values = getValue() ?? []
          if (values.length === 0) return <PlaceholderCell />

          return (
            <div className="flex flex-wrap gap-1 max-w-md">
              {values.slice(0, 5).map((v) => (
                <Badge key={v.id} color="grey" size="small">
                  {v.value}
                </Badge>
              ))}
              {values.length > 5 && (
                <Badge color="blue" size="small">
                  +{values.length - 5} more
                </Badge>
              )}
            </div>
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
          const opt = row.original

          return (
            <ActionMenu
              groups={[
                {
                  actions: [
                    {
                      label: "View Details",
                      icon: <Eye className="text-ui-fg-subtle" />,
                      onClick: () =>
                        router.push(`/products/options/${opt.id}`),
                    },
                    {
                      label: "Edit",
                      icon: <PencilSquare className="text-ui-fg-subtle" />,
                      onClick: () => setEditingOption(opt),
                    },
                  ],
                },
                {
                  actions: [
                    {
                      label: "Delete",
                      icon: <Trash className="text-ui-fg-subtle" />,
                      onClick: () => handleDelete(opt),
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
    data: options,
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
          <Heading level="h1">Product Options</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Manage product option types (Size, Color, Material) and their allowable variant values.
          </Text>
        </div>
        <Button size="small" onClick={() => setIsCreateOpen(true)}>
          <Plus />
          Create Option
        </Button>
      </div>

      <DataTable instance={table}>
        <DataTable.Toolbar className="flex items-center justify-between">
          <DataTable.Search placeholder="Search options..." />
        </DataTable.Toolbar>

        <DataTable.Table />

        <DataTable.Pagination />
      </DataTable>

      {/* Create / Edit Drawer */}
      <ProductOptionDrawer
        open={isCreateOpen || Boolean(editingOption)}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false)
            setEditingOption(null)
          }
        }}
        option={editingOption}
      />
    </div>
  )
}
