"use client"

import {
  listVendorProducts,
  manageVendorCategoryProducts,
  type VendorProduct,
} from "@lib/data/vendor-client"
import {
  Button,
  Checkbox,
  FocusModal,
  Heading,
  Input,
  StatusBadge,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import { MagnifyingGlass } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Image from "next/image"
import { useEffect, useState } from "react"

type CategoryProductsModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  categoryId: string
  categoryName: string
  existingProductIds?: string[]
  onSuccess?: () => void
}

export const CategoryProductsModal = ({
  open,
  onOpenChange,
  categoryId,
  categoryName,
  existingProductIds = [],
  onSuccess,
}: CategoryProductsModalProps) => {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(existingProductIds)
  )

  useEffect(() => {
    setSelectedIds(new Set(existingProductIds))
  }, [existingProductIds, open])

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-products-for-category", search],
    queryFn: () => listVendorProducts({ limit: 100, offset: 0, q: search || undefined }),
    enabled: open,
  })

  const products = data?.products ?? []

  const toggleProduct = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  const selectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)))
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const initialSet = new Set(existingProductIds)
      const toAdd: string[] = []
      const toRemove: string[] = []

      selectedIds.forEach((id) => {
        if (!initialSet.has(id)) {
          toAdd.push(id)
        }
      })

      initialSet.forEach((id) => {
        if (!selectedIds.has(id)) {
          toRemove.push(id)
        }
      })

      return manageVendorCategoryProducts(categoryId, {
        add: toAdd.length ? toAdd : undefined,
        remove: toRemove.length ? toRemove : undefined,
      })
    },
    onSuccess: () => {
      toast.success("Category products updated")
      queryClient.invalidateQueries({ queryKey: ["vendor-categories"] })
      queryClient.invalidateQueries({
        queryKey: ["vendor-category", categoryId],
      })
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update category products")
    },
  })

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content className="flex flex-col">
        <FocusModal.Header className="flex items-center justify-between border-b p-4">
          <div>
            <FocusModal.Title asChild>
              <Heading level="h2">Edit Products in {categoryName}</Heading>
            </FocusModal.Title>
            <FocusModal.Description className="text-ui-fg-subtle text-sm">
              Select which of your products belong to this category.
            </FocusModal.Description>
          </div>
          <div className="flex items-center gap-x-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              isLoading={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              Save ({selectedIds.size} selected)
            </Button>
          </div>
        </FocusModal.Header>

        <FocusModal.Body className="flex flex-1 flex-col gap-y-4 p-6 overflow-y-auto">
          <div className="relative max-w-sm">
            <MagnifyingGlass className="text-ui-fg-muted absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" />
            <Input
              placeholder="Search your products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="border border-ui-border-base rounded-lg overflow-hidden">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell className="w-12">
                    <Checkbox
                      checked={
                        products.length > 0 &&
                        selectedIds.size === products.length
                      }
                      onCheckedChange={selectAll}
                    />
                  </Table.HeaderCell>
                  <Table.HeaderCell>Product</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell>Variants</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {isLoading ? (
                  <Table.Row>
                    <td colSpan={4} className="text-center py-8 text-ui-fg-muted">
                      Loading products...
                    </td>
                  </Table.Row>
                ) : products.length === 0 ? (
                  <Table.Row>
                    <td colSpan={4} className="text-center py-8 text-ui-fg-muted">
                      No products found.
                    </td>
                  </Table.Row>
                ) : (
                  products.map((product) => {
                    const isSelected = selectedIds.has(product.id)

                    return (
                      <Table.Row
                        key={product.id}
                        className="cursor-pointer hover:bg-ui-bg-base-hover"
                        onClick={() => toggleProduct(product.id)}
                      >
                        <Table.Cell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleProduct(product.id)}
                          />
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex items-center gap-x-3">
                            {product.thumbnail ? (
                              <Image
                                src={product.thumbnail}
                                alt={product.title}
                                width={32}
                                height={32}
                                className="rounded object-cover h-8 w-8"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded bg-ui-bg-component flex items-center justify-center text-xs font-semibold text-ui-fg-subtle">
                                {product.title.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <Text size="small" weight="plus">
                                {product.title}
                              </Text>
                              {product.handle && (
                                <Text size="xsmall" className="text-ui-fg-muted">
                                  /{product.handle}
                                </Text>
                              )}
                            </div>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <StatusBadge
                            color={
                              product.status === "published" ? "green" : "grey"
                            }
                          >
                            {product.status}
                          </StatusBadge>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="small" className="text-ui-fg-muted">
                            {product.variants?.length || 0} variant(s)
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    )
                  })
                )}
              </Table.Body>
            </Table>
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}
