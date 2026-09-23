"use client"

import {
  deleteVendorCategory,
  listVendorCategories,
  type VendorCategory,
} from "@lib/data/vendor-client"
import {
  Badge,
  Button,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  DataTableSortingState,
  Heading,
  StatusBadge,
  Text,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { Eye, PencilSquare, Plus, Trash, SquaresPlus, Folder } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { ActionMenu, PlaceholderCell } from "@modules/common"
import { CategoryDrawer } from "./forms/category-drawer"
import { CategoryProductsModal } from "./forms/category-products-modal"

const columnHelper = createDataTableColumnHelper<VendorCategory>()

export const CategoriesTable = () => {
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
  const [editingCategory, setEditingCategory] =
    useState<VendorCategory | null>(null)
  const [managingCategory, setManagingCategory] =
    useState<VendorCategory | null>(null)

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const order = sorting
    ? (sorting.desc ? "-" : "") + sorting.id
    : undefined

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-categories", { limit, offset, q: search, order }],
    queryFn: () =>
      listVendorCategories({
        limit,
        offset,
        q: search || undefined,
        order,
      }),
  })

  const categories = data?.categories ?? []
  const count = data?.count ?? 0

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVendorCategory(id),
    onSuccess: () => {
      toast.success("Category deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-categories"] })
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete category")
    },
  })

  const handleDelete = async (category: VendorCategory) => {
    const confirmed = await prompt({
      title: "Delete Category",
      description: `Are you sure you want to delete "${category.name}"? This cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (confirmed) {
      deleteMutation.mutate(category.id)
    }
  }

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Name",
        enableSorting: true,
        cell: ({ row }) => {
          const cat = row.original
          return (
            <Link
              href={`/products/categories/${cat.id}`}
              className="flex items-center gap-x-2 group"
            >
              <Folder className="text-ui-fg-muted h-4 w-4" />
              <div className="flex flex-col">
                <Text
                  size="small"
                  weight="plus"
                  className="group-hover:text-ui-fg-interactive transition-colors"
                >
                  {cat.name}
                </Text>
                <Text size="xsmall" className="text-ui-fg-muted font-mono">
                  /{cat.handle}
                </Text>
              </div>
            </Link>
          )
        },
      }),
      columnHelper.accessor("parent_category", {
        header: "Parent Category",
        cell: ({ row }) => {
          const parent = row.original.parent_category
          if (!parent) return <Text size="small" className="text-ui-fg-muted">—</Text>
          return (
            <Badge color="grey" size="small">
              {parent.name}
            </Badge>
          )
        },
      }),
      columnHelper.accessor("is_active", {
        header: "Status",
        cell: ({ getValue }) => {
          const active = getValue() ?? true
          return (
            <StatusBadge color={active ? "green" : "grey"}>
              {active ? "Active" : "Inactive"}
            </StatusBadge>
          )
        },
      }),
      columnHelper.accessor("is_internal", {
        header: "Visibility",
        cell: ({ getValue }) => {
          const internal = getValue() ?? false
          return (
            <Badge color={internal ? "orange" : "blue"} size="small">
              {internal ? "Internal" : "Public"}
            </Badge>
          )
        },
      }),
      columnHelper.accessor("products_count", {
        header: "Your Products",
        cell: ({ getValue }) => {
          const val = getValue() ?? 0
          return (
            <Text size="small" className="text-ui-fg-subtle">
              {val} {val === 1 ? "product" : "products"}
            </Text>
          )
        },
      }),
      columnHelper.display({
        id: "actions",
        cell: ({ row }) => {
          const cat = row.original

          return (
            <ActionMenu
              groups={[
                {
                  actions: [
                    {
                      label: "View Details",
                      icon: <Eye className="text-ui-fg-subtle" />,
                      onClick: () =>
                        router.push(`/products/categories/${cat.id}`),
                    },
                    {
                      label: "Edit",
                      icon: <PencilSquare className="text-ui-fg-subtle" />,
                      onClick: () => setEditingCategory(cat),
                    },
                    {
                      label: "Manage Products",
                      icon: <SquaresPlus className="text-ui-fg-subtle" />,
                      onClick: () => setManagingCategory(cat),
                    },
                  ],
                },
                {
                  actions: [
                    {
                      label: "Delete",
                      icon: <Trash className="text-ui-fg-subtle" />,
                      onClick: () => handleDelete(cat),
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
    data: categories,
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
          <Heading level="h1">Categories</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Organize products in a hierarchical taxonomy of product categories.
          </Text>
        </div>
        <Button size="small" onClick={() => setIsCreateOpen(true)}>
          <Plus />
          Create Category
        </Button>
      </div>

      <DataTable instance={table}>
        <DataTable.Toolbar className="flex items-center justify-between">
          <DataTable.Search placeholder="Search categories..." />
        </DataTable.Toolbar>

        <DataTable.Table />

        <DataTable.Pagination />
      </DataTable>

      {/* Create / Edit Drawer */}
      <CategoryDrawer
        open={isCreateOpen || Boolean(editingCategory)}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false)
            setEditingCategory(null)
          }
        }}
        category={editingCategory}
      />

      {/* Manage Products Modal */}
      {managingCategory && (
        <CategoryProductsModal
          open={Boolean(managingCategory)}
          onOpenChange={(open) => {
            if (!open) setManagingCategory(null)
          }}
          categoryId={managingCategory.id}
          categoryName={managingCategory.name}
          existingProductIds={(managingCategory.products || []).map(
            (p) => p.id
          )}
        />
      )}
    </div>
  )
}
