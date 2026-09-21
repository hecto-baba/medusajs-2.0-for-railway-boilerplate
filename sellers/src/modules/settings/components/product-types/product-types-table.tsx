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
  DataTable,
  DataTablePaginationState,
  DataTableSortingState,
  Heading,
  Select,
  Text,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { ProductTypeDrawer } from "./product-type-drawer"

const columnHelper = createDataTableColumnHelper<VendorProductTypeItem>()

export const ProductTypesTable = () => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [search, setSearch] = useState("")
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)
  const [dateFilter, setDateFilter] = useState<string>("all")

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<VendorProductTypeItem | null>(null)

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit
  const order = sorting?.id
    ? sorting.desc
      ? `-${sorting.id}`
      : sorting.id
    : undefined

  const getCreatedAtGte = (filter: string) => {
    if (filter === "7d") {
      return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    }
    if (filter === "30d") {
      return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    }
    if (filter === "90d") {
      return new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    }
    return undefined
  }

  const createdAtGte = getCreatedAtGte(dateFilter)

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-product-types", limit, offset, search, order, dateFilter],
    queryFn: () =>
      listVendorProductTypes({
        limit,
        offset,
        q: search.trim() || undefined,
        order,
        created_at_gte: createdAtGte,
      }),
    placeholderData: (previous) => previous,
  })

  const { mutateAsync: removeType } = useMutation({
    mutationFn: (id: string) => deleteVendorProductType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-product-types"] })
    },
  })

  const handleDelete = async (item: VendorProductTypeItem) => {
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
  }

  const columns = [
    columnHelper.accessor("value", {
      header: "Type",
      enableSorting: true,
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
      header: "Created",
      enableSorting: true,
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
  ]

  const table = useDataTable({
    columns,
    data: data?.product_types ?? [],
    rowCount: data?.count ?? 0,
    getRowId: (row) => row.id,
    isLoading,
    pagination: { state: pagination, onPaginationChange: setPagination },
    search: { state: search, onSearchChange: setSearch },
    sorting: { state: sorting, onSortingChange: setSorting },
  })

  return (
    <Container className="p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-4">
          <div>
            <Heading level="h2">Product Types</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Manage product types used across your catalog.
            </Text>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <DataTable.Search placeholder="Search product types..." />
            <div className="w-36">
              <Select size="small" value={dateFilter} onValueChange={setDateFilter}>
                <Select.Trigger>
                  <Select.Value placeholder="Created" />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="all">All time</Select.Item>
                  <Select.Item value="7d">Past 7 days</Select.Item>
                  <Select.Item value="30d">Past 30 days</Select.Item>
                  <Select.Item value="90d">Past 90 days</Select.Item>
                </Select.Content>
              </Select>
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
        </DataTable.Toolbar>
        <DataTable.Table />
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
