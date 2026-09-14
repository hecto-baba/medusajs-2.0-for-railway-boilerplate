"use client"

import {
  deleteVendorSalesChannel,
  getVendorSalesChannel,
  manageVendorSalesChannelProducts,
  type VendorProduct,
  type VendorSalesChannel,
} from "@lib/data/vendor-client"
import {
  ArrowLeft,
  Channels,
  PencilSquare,
  PlusMini,
  Trash,
} from "@medusajs/icons"
import {
  Avatar,
  Badge,
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  Heading,
  StatusBadge,
  Text,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { SalesChannelAddProductsModal } from "./sales-channel-add-products-modal"
import { SalesChannelDrawer } from "./sales-channel-drawer"

const columnHelper = createDataTableColumnHelper<VendorProduct>()

type SalesChannelDetailProps = {
  id: string
}

export const SalesChannelDetail = ({ id }: SalesChannelDetailProps) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [editOpen, setEditOpen] = useState(false)
  const [addProductsOpen, setAddProductsOpen] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ["vendor-sales-channel", id],
    queryFn: () => getVendorSalesChannel(id),
  })

  const { mutateAsync: removeChannel, isPending: isDeleting } = useMutation({
    mutationFn: () => deleteVendorSalesChannel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-sales-channels"] })
      toast.success("Sales channel deleted")
      router.push("/settings/sales-channels")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete sales channel")
    },
  })

  const { mutateAsync: removeProduct } = useMutation({
    mutationFn: (productId: string) =>
      manageVendorSalesChannelProducts(id, { remove: [productId] }),
    onSuccess: () => {
      toast.success("Product removed from sales channel")
      queryClient.invalidateQueries({ queryKey: ["vendor-sales-channel", id] })
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to remove product")
    },
  })

  const handleDelete = async () => {
    const channelName = data?.sales_channel?.name || "this sales channel"
    const confirmed = await prompt({
      title: "Delete sales channel",
      description: `Are you sure you want to delete "${channelName}"? Products assigned to this channel will not be deleted.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (confirmed) {
      await removeChannel()
    }
  }

  const handleRemoveProduct = async (product: VendorProduct) => {
    const confirmed = await prompt({
      title: "Remove product from channel",
      description: `Are you sure you want to remove "${product.title}" from this sales channel?`,
      confirmText: "Remove",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (confirmed) {
      await removeProduct(product.id)
    }
  }

  const productColumns = [
    columnHelper.accessor("title", {
      header: "Product",
      cell: ({ row }) => {
        const product = row.original
        return (
          <div className="flex items-center gap-x-3">
            {product.thumbnail ? (
              <img
                src={product.thumbnail}
                alt={product.title}
                className="h-8 w-8 rounded object-cover border"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded border bg-ui-bg-subtle text-ui-fg-subtle text-xs">
                {product.title?.[0] || "P"}
              </div>
            )}
            <div className="flex flex-col">
              <Text size="small" weight="plus" className="text-ui-fg-base">
                {product.title}
              </Text>
              {product.collection && (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {product.collection.title}
                </Text>
              )}
            </div>
          </div>
        )
      },
    }),
    columnHelper.accessor("status", {
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge
          color={row.original.status === "published" ? "green" : "grey"}
        >
          {row.original.status}
        </StatusBadge>
      ),
    }),
    columnHelper.accessor("variants", {
      header: "Variants",
      cell: ({ row }) => (
        <Text size="small" className="text-ui-fg-subtle">
          {row.original.variants?.length || 0}
        </Text>
      ),
    }),
    columnHelper.action({
      actions: (ctx) => [
        {
          label: "Remove from channel",
          icon: <Trash />,
          onClick: () => handleRemoveProduct(ctx.row.original),
        },
      ],
    }),
  ]

  const products = data?.sales_channel?.products ?? []
  const productsTable = useDataTable({
    columns: productColumns,
    data: products,
    rowCount: products.length,
    getRowId: (row) => row.id,
    isLoading,
  })

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Text size="small" className="text-ui-fg-subtle">
          Loading sales channel...
        </Text>
      </div>
    )
  }

  if (error || !data?.sales_channel) {
    return (
      <div className="p-6">
        <div className="mb-4">
          <Link
            href="/settings/sales-channels"
            className="flex items-center gap-x-2 text-ui-fg-subtle hover:text-ui-fg-base text-sm"
          >
            <ArrowLeft className="h-4 w-4" /> Back to sales channels
          </Link>
        </div>
        <Container className="p-6 text-center">
          <Heading level="h3" className="text-ui-fg-error mb-2">
            Sales Channel Not Found
          </Heading>
          <Text size="small" className="text-ui-fg-subtle mb-4">
            The requested sales channel does not exist or you do not have permission to access it.
          </Text>
          <Button variant="secondary" onClick={() => router.push("/settings/sales-channels")}>
            Return to Sales Channels
          </Button>
        </Container>
      </div>
    )
  }

  const channel = data.sales_channel

  return (
    <div className="flex flex-col gap-y-6 p-6">
      {/* Top navigation & action header */}
      <div className="flex items-center justify-between">
        <Link
          href="/settings/sales-channels"
          className="flex items-center gap-x-2 text-ui-fg-subtle hover:text-ui-fg-base text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Back to sales channels
        </Link>
        <div className="flex items-center gap-x-2">
          <Button
            size="small"
            variant="secondary"
            onClick={() => setEditOpen(true)}
          >
            <PencilSquare />
            Edit Channel
          </Button>
          <Button
            size="small"
            variant="danger"
            isLoading={isDeleting}
            onClick={handleDelete}
          >
            <Trash />
            Delete
          </Button>
        </div>
      </div>

      {/* Title section */}
      <div className="flex items-center gap-x-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-ui-bg-subtle shadow-sm">
          <Channels className="h-6 w-6 text-ui-fg-base" />
        </div>
        <div className="flex flex-col gap-y-1">
          <div className="flex items-center gap-x-2">
            <Heading level="h1">{channel.name}</Heading>
            <StatusBadge color={channel.is_disabled ? "grey" : "green"}>
              {channel.is_disabled ? "Disabled" : "Active"}
            </StatusBadge>
          </div>
          {channel.description && (
            <Text size="small" className="text-ui-fg-subtle">
              {channel.description}
            </Text>
          )}
        </div>
      </div>

      {/* Products in this sales channel */}
      <Container className="p-0">
        <DataTable instance={productsTable}>
          <DataTable.Toolbar className="flex items-center justify-between gap-x-2 px-6 py-4">
            <div>
              <Heading level="h2">Products ({products.length})</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Products currently published and available in this sales channel.
              </Text>
            </div>
            <Button
              size="small"
              variant="secondary"
              onClick={() => setAddProductsOpen(true)}
            >
              <PlusMini />
              Add Products
            </Button>
          </DataTable.Toolbar>
          <DataTable.Table />
        </DataTable>
      </Container>

      <SalesChannelDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        salesChannel={channel}
      />

      <SalesChannelAddProductsModal
        open={addProductsOpen}
        onOpenChange={setAddProductsOpen}
        salesChannelId={id}
        existingProductIds={products.map((p) => p.id)}
      />
    </div>
  )
}
