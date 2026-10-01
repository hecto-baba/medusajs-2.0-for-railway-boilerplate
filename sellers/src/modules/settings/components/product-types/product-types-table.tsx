"use client"

import {
  deleteVendorProductType,
  listVendorProductTypes,
  type VendorProductTypeItem,
} from "@lib/data/vendor-client"
import { PencilSquare, PlusMini, Tag, Trash } from "@medusajs/icons"
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
  Text,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo, useState } from "react"
import { ProductTypeDrawer } from "./product-type-drawer"

const columnHelper = createDataTableColumnHelper<VendorProductTypeItem>()
const filterHelper = createDataTableFilterHelper<VendorProductTypeItem>()

const extractFilterValue = (val: any): string | undefined => {
  if (!val) return undefined
  if (typeof val === "string") return val
  if (Array.isArray(val)) return val[0]
  if (typeof val === "object") {
    const flat = Object.values(val).flat()
    return (flat[0] as string) || undefined
  }
  return undefined
}

const filters = [
  filterHelper.custom({
    id: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Active", value: "active" },
      { label: "Inactive", value: "inactive" },
    ],
  }),
  filterHelper.custom({
    id: "created_at",
    label: "Created",
    type: "select",
    options: [
      { label: "Last 7 days", value: "7d" },
      { label: "Last 30 days", value: "30d" },
      { label: "Last 90 days", value: "90d" },
    ],
  }),
  filterHelper.custom({
    id: "updated_at",
    label: "Updated",
    type: "select",
    options: [
      { label: "Last 7 days", value: "7d" },
      { label: "Last 30 days", value: "30d" },
      { label: "Last 90 days", value: "90d" },
    ],
  }),
]

export const ProductTypesTable = () => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [search, setSearch] = useState("")
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)
  const [filtering, setFiltering] = useState<DataTableFilteringState>({})

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<VendorProductTypeItem | null>(null)

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit
  const order = sorting
    ? (sorting.desc ? "-" : "") + sorting.id
    : undefined

  const statusVal = extractFilterValue(filtering.status)
  const createdVal = extractFilterValue(filtering.created_at)
  const updatedVal = extractFilterValue(filtering.updated_at)

  const createdAtGte = useMemo(() => {
    if (!createdVal) return undefined
    const days = createdVal === "7d" ? 7 : createdVal === "30d" ? 30 : 90
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  }, [createdVal])

  const updatedAtGte = useMemo(() => {
    if (!updatedVal) return undefined
    const days = updatedVal === "7d" ? 7 : updatedVal === "30d" ? 30 : 90
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  }, [updatedVal])

  const { data, isLoading } = useQuery({
    queryKey: [
      "vendor-product-types",
      limit,
      offset,
      search,
      order,
      statusVal,
      createdAtGte,
      updatedAtGte,
    ],
    queryFn: () =>
      listVendorProductTypes({
        limit,
        offset,
        q: search.trim() || undefined,
        order,
        status: statusVal,
        created_at_gte: createdAtGte,
        updated_at_gte: updatedAtGte,
      }),
    placeholderData: (previous) => previous,
  })

  const { mutateAsync: removeType } = useMutation({
    mutationFn: (id: string) => deleteVendorProductType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-product-types"] })
    },
  })

  const handleDelete = useCallback(
    async (item: VendorProductTypeItem) => {
      const confirmed = await prompt({
        title: "Delete product type",
        description: `Are you sure you want to delete "${item.value}"? Products with this type will have their type unassigned.`,
        confirmText: "Delete",
        cancelText: "Cancel",
        variant: "danger",
      })

      if (!confirmed) {
        return
      }

      try {
        await removeType(item.id)
        toast.success(`"${item.value}" was deleted.`)
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not delete product type."
        )
      }
    },
    [prompt, removeType]
  )

  const columns = useMemo(
    () => [
      columnHelper.accessor("value", {
        id: "value",
        header: "Type",
        enableSorting: true,
        sortLabel: "Value",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
        cell: ({ row }) => (
          <div className="flex items-center gap-x-2">
            <Tag className="text-ui-fg-subtle h-4 w-4" />
            <Text size="small" weight="plus" className="text-ui-fg-base">
              {row.original.value}
            </Text>
          </div>
        ),
      }),
      columnHelper.accessor("created_at", {
        id: "created_at",
        header: "Created",
        enableSorting: true,
        sortLabel: "Created",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
        cell: ({ row }) => {
          const date = row.original.created_at
            ? new Date(row.original.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "-"
          return (
            <Text size="small" className="text-ui-fg-subtle">
              {date}
            </Text>
          )
        },
      }),
      columnHelper.accessor("updated_at", {
        id: "updated_at",
        header: "Updated",
        enableSorting: true,
        sortLabel: "Updated",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
        cell: ({ row }) => {
          const date = row.original.updated_at
            ? new Date(row.original.updated_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "-"
          return (
            <Text size="small" className="text-ui-fg-subtle">
              {date}
            </Text>
          )
        },
      }),
      columnHelper.action({
        actions: (ctx) => [
          {
            label: "Edit",
            icon: <PencilSquare />,
            onClick: () => {
              setSelectedType(ctx.row.original)
              setDrawerOpen(true)
            },
          },
          {
            label: "Delete",
            icon: <Trash />,
            onClick: () => handleDelete(ctx.row.original),
          },
        ],
      }),
    ],
    [handleDelete]
  )

  const table = useDataTable({
    columns,
    data: data?.product_types ?? [],
    rowCount: data?.count ?? 0,
    getRowId: (row) => row.id,
    isLoading,
    pagination: { state: pagination, onPaginationChange: setPagination },
    filtering: { state: filtering, onFilteringChange: setFiltering },
    sorting: { state: sorting, onSortingChange: setSorting },
    search: { state: search, onSearchChange: setSearch },
    filters,
  })

  return (
    <Container className="p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex flex-col gap-y-3 px-6 py-4">
          <div className="flex items-center justify-between gap-x-2">
            <div>
              <Heading level="h2">Product Types</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Manage product types used across your catalog.
              </Text>
            </div>
            <Button
              size="small"
              variant="secondary"
              onClick={() => {
                setSelectedType(null)
                setDrawerOpen(true)
              }}
              className="shrink-0"
            >
              <PlusMini />
              Create Type
            </Button>
          </div>

          <div className="flex items-center justify-end gap-x-2 border-b pb-3">
            <DataTable.Search placeholder="Search product types..." />
            <DataTable.FilterMenu tooltip="Filter" />
            <DataTable.SortingMenu tooltip="Sort" />
          </div>
        </DataTable.Toolbar>

        <DataTable.FilterBar />

        <DataTable.Table
          emptyState={{
            empty: {
              heading: "No product types",
              description: "Create a product type to get started.",
            },
            filtered: {
              heading: "No results found",
              description: "Try changing your search or filter options.",
            },
          }}
        />

        <DataTable.Pagination />
      </DataTable>

      <ProductTypeDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        productType={selectedType}
      />
    </Container>
  )
}
