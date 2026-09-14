"use client"

import {
  deleteVendorCategory,
  getVendorCategory,
  manageVendorCategoryProducts,
  type VendorCategory,
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
  Folder,
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
import { CategoryDrawer } from "../forms/category-drawer"
import { CategoryProductsModal } from "../forms/category-products-modal"

type CategoryDetailProps = {
  id: string
}

export const CategoryDetail = ({ id }: CategoryDetailProps) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isAddProductsOpen, setIsAddProductsOpen] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ["vendor-category", id],
    queryFn: () => getVendorCategory(id),
  })

  const category = data?.category

  const deleteMutation = useMutation({
    mutationFn: () => deleteVendorCategory(id),
    onSuccess: () => {
      toast.success("Category deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-categories"] })
      router.push("/products/categories")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete category")
    },
  })

  const removeProductMutation = useMutation({
    mutationFn: (productId: string) =>
      manageVendorCategoryProducts(id, { remove: [productId] }),
    onSuccess: () => {
      toast.success("Product removed from category")
      queryClient.invalidateQueries({ queryKey: ["vendor-category", id] })
      queryClient.invalidateQueries({ queryKey: ["vendor-categories"] })
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to remove product")
    },
  })

  const handleDelete = async () => {
    if (!category) return

    const confirmed = await prompt({
      title: "Delete Category",
      description: `Are you sure you want to delete "${category.name}"? This cannot be undone.`,
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
      description: `Remove "${productTitle}" from this category?`,
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
        <Text className="text-ui-fg-muted">Loading category details...</Text>
      </div>
    )
  }

  if (error || !category) {
    return (
      <div className="flex flex-col items-center justify-center gap-y-4 p-16">
        <Text className="text-ui-fg-error">Category not found or access denied.</Text>
        <Button variant="secondary" onClick={() => router.push("/products/categories")}>
          <ArrowLeft /> Back to Categories
        </Button>
      </div>
    )
  }

  const products = category.products || []
  const subcategories = category.category_children || []

  return (
    <div className="flex flex-col gap-y-6 p-8 max-w-7xl mx-auto">
      {/* Top bar back link */}
      <div>
        <Link
          href="/products/categories"
          className="text-ui-fg-subtle hover:text-ui-fg-base inline-flex items-center gap-x-2 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Categories</span>
        </Link>
      </div>

      {/* Header Container */}
      <Container className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-y-2">
            <div className="flex items-center gap-x-3">
              <Heading level="h1">{category.name}</Heading>
              <Badge color="blue" size="small" className="font-mono">
                /{category.handle}
              </Badge>
              <StatusBadge
                color={category.is_active ? "green" : "grey"}
              >
                {category.is_active ? "Active" : "Inactive"}
              </StatusBadge>
              {category.is_internal && (
                <Badge color="orange" size="small">
                  Internal
                </Badge>
              )}
            </div>

            {category.parent_category && (
              <div className="flex items-center gap-x-2 text-sm text-ui-fg-subtle">
                <span>Parent:</span>
                <Link
                  href={`/products/categories/${category.parent_category.id}`}
                  className="font-medium text-ui-fg-interactive hover:underline"
                >
                  {category.parent_category.name}
                </Link>
              </div>
            )}

            {category.description && (
              <Text size="small" className="text-ui-fg-subtle max-w-2xl">
                {category.description}
              </Text>
            )}

            <Text size="small" className="text-ui-fg-muted">
              Created on{" "}
              {new Date(category.created_at).toLocaleDateString(undefined, {
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

      {/* Subcategories Section (if any) */}
      {subcategories.length > 0 && (
        <Container className="p-6 flex flex-col gap-y-4">
          <div>
            <Heading level="h2">Subcategories</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Direct subcategories under {category.name} ({subcategories.length})
            </Text>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {subcategories.map((child: any) => (
              <Link
                key={child.id}
                href={`/products/categories/${child.id}`}
                className="flex items-center gap-x-3 p-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle hover:bg-ui-bg-base-hover hover:border-ui-border-strong transition-all group"
              >
                <Folder className="h-5 w-5 text-ui-fg-muted group-hover:text-ui-fg-interactive transition-colors" />
                <div className="flex flex-col">
                  <Text size="small" weight="plus">
                    {child.name}
                  </Text>
                  {child.handle && (
                    <Text size="xsmall" className="text-ui-fg-muted font-mono">
                      /{child.handle}
                    </Text>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </Container>
      )}

      {/* Products Section */}
      <Container className="p-6 flex flex-col gap-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h2">Products</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Your products in this category ({products.length})
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
                    No products in this category yet.
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
                        title="Remove from category"
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
      <CategoryDrawer
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        category={category}
      />

      {/* Add Products Modal */}
      <CategoryProductsModal
        open={isAddProductsOpen}
        onOpenChange={setIsAddProductsOpen}
        categoryId={category.id}
        categoryName={category.name}
        existingProductIds={products.map((p: any) => p.id)}
      />
    </div>
  )
}
