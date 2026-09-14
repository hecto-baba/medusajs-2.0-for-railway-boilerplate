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
  Heading,
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
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<VendorProductTypeItem | null>(null)

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-product-types", limit, offset],
    queryFn: () => listVendorProductTypes({ limit, offset }),
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
  })

  return (
    <Container className="p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex items-center justify-between gap-x-2 px-6 py-4">
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
          >
            <PlusMini />
            Create Type
          </Button>
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
