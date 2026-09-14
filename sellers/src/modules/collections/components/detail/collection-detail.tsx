"use client"

import {
  deleteVendorCollection,
  getVendorCollection,
  manageVendorCollectionProducts,
  type VendorCollection,
} from "@lib/data/vendor-client"
import {
  Badge,
  Button,
  Container,
  Heading,
  StatusBadge,
  Table,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import {
  ArrowLeft,
  Eye,
  PencilSquare,
  Plus,
  Trash,
  XMark,
} from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { CollectionDrawer } from "../forms/collection-drawer"
import { CollectionProductsModal } from "../forms/collection-products-modal"

type CollectionDetailProps = {
  id: string
}

export const CollectionDetail = ({ id }: CollectionDetailProps) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isAddProductsOpen, setIsAddProductsOpen] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ["vendor-collection", id],
    queryFn: () => getVendorCollection(id),
  })

  const collection = data?.collection

  const deleteMutation = useMutation({
    mutationFn: () => deleteVendorCollection(id),
    onSuccess: () => {
      toast.success("Collection deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-collections"] })
      router.push("/products/collections")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete collection")
    },
  })

  const removeProductMutation = useMutation({
    mutationFn: (productId: string) =>
      manageVendorCollectionProducts(id, { remove: [productId] }),
    onSuccess: () => {
      toast.success("Product removed from collection")
      queryClient.invalidateQueries({ queryKey: ["vendor-collection", id] })
      queryClient.invalidateQueries({ queryKey: ["vendor-collections"] })
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to remove product")
    },
  })

  const handleDelete = async () => {
    if (!collection) return

    const confirmed = await prompt({
      title: "Delete Collection",
      description: `Are you sure you want to delete "${collection.title}"? This cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (confirmed) {
      deleteMutation.mutate()
    }
  }

  const handleRemoveProduct = async (productId: string, productTitle: string) => {
    const confirmed = await prompt({
      title: "Remove Product",
      description: `Remove "${productTitle}" from this collection?`,
      confirmText: "Remove",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (confirmed) {
      removeProductMutation.mutate(productId)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Text className="text-ui-fg-muted">Loading collection details...</Text>
      </div>
    )
  }

  if (error || !collection) {
    return (
      <div className="flex flex-col items-center justify-center gap-y-4 p-16">
        <Text className="text-ui-fg-error">Collection not found or access denied.</Text>
        <Button variant="secondary" onClick={() => router.push("/products/collections")}>
          <ArrowLeft /> Back to Collections
        </Button>
      </div>
    )
  }

  const products = collection.products || []

  return (
    <div className="flex flex-col gap-y-6 p-8 max-w-7xl mx-auto">
      {/* Top bar back link */}
      <div>
        <Link
          href="/products/collections"
          className="text-ui-fg-subtle hover:text-ui-fg-base inline-flex items-center gap-x-2 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Collections</span>
        </Link>
      </div>

      {/* Header Container */}
      <Container className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-y-1">
            <div className="flex items-center gap-x-3">
              <Heading level="h1">{collection.title}</Heading>
              <Badge color="blue" size="small" className="font-mono">
                /{collection.handle}
              </Badge>
            </div>
            <Text size="small" className="text-ui-fg-muted">
              Created on{" "}
              {new Date(collection.created_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Text>
          </div>

          <div className="flex items-center gap-x-2">
            <Button
              variant="secondary"
              size="small"
              onClick={() => setIsEditOpen(true)}
            >
              <PencilSquare className="h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="danger"
              size="small"
              onClick={handleDelete}
              isLoading={deleteMutation.isPending}
            >
              <Trash className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </Container>

      {/* Products Section */}
      <Container className="p-6 flex flex-col gap-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h2">Products</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Products in this collection ({products.length})
            </Text>
          </div>
          <Button
            size="small"
            variant="secondary"
            onClick={() => setIsAddProductsOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add Products
          </Button>
        </div>

        <div className="border border-ui-border-base rounded-lg overflow-hidden">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Product</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Variants</Table.HeaderCell>
                <Table.HeaderCell className="w-16 text-right">Action</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {products.length === 0 ? (
                <Table.Row>
                  <td colSpan={4} className="text-center py-10 text-ui-fg-muted">
                    No products in this collection yet.
                  </td>
                </Table.Row>
              ) : (
                products.map((prod: any) => (
                  <Table.Row key={prod.id}>
                    <Table.Cell>
                      <Link
                        href={`/products/${prod.id}`}
                        className="flex items-center gap-x-3 group"
                      >
                        {prod.thumbnail ? (
                          <Image
                            src={prod.thumbnail}
                            alt={prod.title}
                            width={32}
                            height={32}
                            className="rounded object-cover h-8 w-8"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded bg-ui-bg-component flex items-center justify-center text-xs font-semibold text-ui-fg-subtle">
                            {prod.title.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <Text
                            size="small"
                            weight="plus"
                            className="group-hover:text-ui-fg-interactive transition-colors"
                          >
                            {prod.title}
                          </Text>
                          {prod.handle && (
                            <Text size="xsmall" className="text-ui-fg-muted font-mono">
                              /{prod.handle}
                            </Text>
                          )}
                        </div>
                      </Link>
                    </Table.Cell>
                    <Table.Cell>
                      <StatusBadge
                        color={prod.status === "published" ? "green" : "grey"}
                      >
                        {prod.status}
                      </StatusBadge>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small" className="text-ui-fg-subtle">
                        {prod.variants?.length || 0} variant(s)
                      </Text>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <Button
                        variant="transparent"
                        size="small"
                        className="text-ui-fg-muted hover:text-ui-fg-error"
                        onClick={() => handleRemoveProduct(prod.id, prod.title)}
                        title="Remove from collection"
                      >
                        <XMark className="h-4 w-4" />
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table>
        </div>
      </Container>

      {/* Edit Drawer */}
      <CollectionDrawer
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        collection={collection}
      />

      {/* Add Products Modal */}
      <CollectionProductsModal
        open={isAddProductsOpen}
        onOpenChange={setIsAddProductsOpen}
        collectionId={collection.id}
        collectionTitle={collection.title}
        existingProductIds={products.map((p: any) => p.id)}
      />
    </div>
  )
}
