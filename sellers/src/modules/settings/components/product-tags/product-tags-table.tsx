"use client"

import {
  deleteVendorProductTag,
  listVendorProductTags,
  type VendorProductTagItem,
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
import { ProductTagDrawer } from "./product-tag-drawer"

const columnHelper = createDataTableColumnHelper<VendorProductTagItem>()

export const ProductTagsTable = () => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedTag, setSelectedTag] = useState<VendorProductTagItem | null>(null)

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-product-tags", limit, offset],
    queryFn: () => listVendorProductTags({ limit, offset }),
    placeholderData: (previous) => previous,
  })

  const { mutateAsync: removeTag } = useMutation({
    mutationFn: (id: string) => deleteVendorProductTag(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-product-tags"] })
    },
  })

  const handleDelete = async (item: VendorProductTagItem) => {
    const confirmed = await prompt({
      title: "Delete product tag",
      description: `Are you sure you want to delete tag "${item.value}"? It will be removed from all products.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (!confirmed) {
      return
    }

    try {
      await removeTag(item.id)
      toast.success(`Tag "${item.value}" was deleted.`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete product tag."
      )
    }
  }

  const columns = [
    columnHelper.accessor("value", {
      header: "Tag",
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
            setSelectedTag(ctx.row.original)
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
    data: data?.product_tags ?? [],
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
            <Heading level="h2">Product Tags</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Manage product tags to label and filter items across your store.
            </Text>
          </div>
          <Button
            size="small"
            variant="secondary"
            onClick={() => {
              setSelectedTag(null)
              setDrawerOpen(true)
            }}
          >
            <PlusMini />
            Create Tag
          </Button>
        </DataTable.Toolbar>
        <DataTable.Table />
        <DataTable.Pagination />
      </DataTable>

      <ProductTagDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        productTag={selectedTag}
      />
    </Container>
  )
}
