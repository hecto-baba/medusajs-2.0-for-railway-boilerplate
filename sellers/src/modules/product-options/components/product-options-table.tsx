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
import { Eye, PencilSquare, Plus, Trash } from "@medusajs/icons"
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
import { ProductOptionDrawer } from "./forms/product-option-drawer"

const columnHelper = createDataTableColumnHelper<VendorProductOptionItem>()
const filterHelper = createDataTableFilterHelper<VendorProductOptionItem>()

const extractFilterVal = (val: unknown): string | undefined => {
  if (!val) return undefined
  if (typeof val === "string") return val
  if (typeof val === "number") return String(val)
  if (Array.isArray(val)) return val[0]
  if (typeof val === "object") {
    const flat = Object.values(val).flat()
    return (flat[0] as string) || undefined
  }
  return undefined
}

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

export const ProductOptionsTable = () => {
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

  // Drawer states
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingOption, setEditingOption] =
    useState<VendorProductOptionItem | null>(null)

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const order = sorting
    ? (sorting.desc ? "-" : "") + sorting.id
    : undefined

  const typeFilterVal = extractFilterVal(filtering.is_exclusive)
  const isExclusive =
    typeFilterVal === "true"
      ? true
      : typeFilterVal === "false"
      ? false
      : undefined

  const created_at_gte = resolveDateFilter(filtering.created_at)
  const updated_at_gte = resolveDateFilter(filtering.updated_at)

  const { data, isLoading } = useQuery({
    queryKey: [
      "vendor-product-options",
      { limit, offset, q: search, order, isExclusive, created_at_gte, updated_at_gte },
    ],
    queryFn: () =>
      listVendorProductOptions({
        limit,
        offset,
        q: search || undefined,
        is_exclusive: isExclusive,
        created_at_gte,
        updated_at_gte,
        order,
      }),
    placeholderData: keepPreviousData,
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

  const filters = useMemo(
    () => [
      filterHelper.accessor("is_exclusive", {
        type: "radio",
        label: "Type",
        options: [
          {
            label: "Product-specific",
            value: "true",
          },
          {
            label: "Global",
            value: "false",
          },
        ],
      }),
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
        header: "Option Title",
        enableSorting: true,
        sortLabel: "Title",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
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
