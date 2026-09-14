"use client"

import {
  removeProductsFromPriceList,
  type VendorPriceList,
} from "@lib/data/vendor-client"
import { ActionMenu, Thumbnail } from "@modules/common"
import {
  Badge,
  Button,
  Container,
  Heading,
  Table,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import {
  CurrencyDollar,
  PencilSquare,
  Plus,
  Trash,
  TriangleRightMini,
} from "@medusajs/icons"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useState } from "react"
import { PriceListPricesModal } from "../forms/price-list-prices-modal"

type ProductsSectionProps = {
  priceList: VendorPriceList
}

export const ProductsSection = ({ priceList }: ProductsSectionProps) => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [isPricesModalOpen, setIsPricesModalOpen] = useState(false)
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({})

  const products = priceList.products ?? []

  const removeProductMutation = useMutation({
    mutationFn: (productId: string) =>
      removeProductsFromPriceList(priceList.id, [productId]),
    onSuccess: () => {
      toast.success("Product removed from price list")
      queryClient.invalidateQueries({
        queryKey: ["vendor-price-list", priceList.id],
      })
      queryClient.invalidateQueries({
        queryKey: ["vendor-price-lists"],
      })
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to remove product from price list")
    },
  })

  const handleRemoveProduct = async (productTitle: string, productId: string) => {
    const confirmed = await prompt({
      title: "Remove Product from Price List",
      description: `Are you sure you want to remove "${productTitle}" and all its variant prices from this price list?`,
      confirmText: "Remove",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (confirmed) {
      removeProductMutation.mutate(productId)
    }
  }

  const toggleProductExpand = (productId: string) => {
    setExpandedProducts((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }))
  }

  const formatCurrency = (amount: number, currencyCode: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode.toUpperCase(),
    }).format(amount)
  }

  const totalPricesCount = products.reduce((acc, p) => {
    return acc + p.variants.reduce((vAcc, v) => vAcc + v.prices.length, 0)
  }, 0)

  return (
    <>
      <Container className="p-0 overflow-hidden">
        {/* Section Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <div className="flex items-center gap-x-2">
              <Heading level="h2">Products & Prices</Heading>
              <Badge size="small" color="grey">
                {products.length} {products.length === 1 ? "product" : "products"}
              </Badge>
              <Badge size="small" color="blue">
                {totalPricesCount} {totalPricesCount === 1 ? "price" : "prices"}
              </Badge>
            </div>
            <Text size="small" className="text-ui-fg-subtle mt-0.5">
              Specific prices defined for variants in this price list.
            </Text>
          </div>

          <Button
            size="small"
            variant="secondary"
            onClick={() => setIsPricesModalOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Products & Prices
          </Button>
        </div>

        {/* Product List */}
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ui-bg-subtle text-ui-fg-subtle mb-3">
              <CurrencyDollar className="h-6 w-6" />
            </div>
            <Heading level="h3" className="text-ui-fg-base">
              No products added yet
            </Heading>
            <Text size="small" className="text-ui-fg-subtle max-w-sm mt-1 mb-4">
              Add your store&apos;s products and set special variant prices, quantity rules, or discounts.
            </Text>
            <Button
              size="small"
              variant="secondary"
              onClick={() => setIsPricesModalOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Products & Prices
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-ui-border-base">
            {products.map((product) => {
              const isExpanded = expandedProducts[product.id] ?? true
              const productPricesCount = product.variants.reduce(
                (sum, v) => sum + v.prices.length,
                0
              )

              return (
                <div key={product.id} className="flex flex-col">
                  {/* Product Header Row */}
                  <div className="flex items-center justify-between p-4 bg-ui-bg-subtle/40 hover:bg-ui-bg-subtle/80 transition-colors">
                    <div
                      className="flex items-center gap-x-3 cursor-pointer select-none flex-1"
                      onClick={() => toggleProductExpand(product.id)}
                    >
                      <button
                        type="button"
                        className="text-ui-fg-subtle hover:text-ui-fg-base"
                        aria-label="Toggle details"
                      >
                        <TriangleRightMini
                          className={`h-4 w-4 transition-transform ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                        />
                      </button>

                      <Thumbnail src={product.thumbnail} />

                      <div>
                        <div className="flex items-center gap-x-2">
                          <Link
                            href={`/products/${product.id}`}
                            className="font-medium text-ui-fg-base hover:underline text-sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {product.title}
                          </Link>
                          <Badge size="small" color="grey">
                            {product.variants.length}{" "}
                            {product.variants.length === 1
                              ? "variant"
                              : "variants"}
                          </Badge>
                          <Badge size="small" color="blue">
                            {productPricesCount}{" "}
                            {productPricesCount === 1 ? "price" : "prices"}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-x-2">
                      <ActionMenu
                        groups={[
                          {
                            actions: [
                              {
                                label: "Manage Prices",
                                icon: <PencilSquare className="h-4 w-4" />,
                                onClick: () => setIsPricesModalOpen(true),
                              },
                              {
                                label: "Remove Product",
                                icon: <Trash className="h-4 w-4 text-ui-fg-error" />,
                                onClick: () =>
                                  handleRemoveProduct(product.title, product.id),
                              },
                            ],
                          },
                        ]}
                      />
                    </div>
                  </div>

                  {/* Variants & Prices Table */}
                  {isExpanded && (
                    <div className="border-t border-ui-border-base">
                      <Table>
                        <Table.Header>
                          <Table.Row>
                            <Table.HeaderCell>Variant</Table.HeaderCell>
                            <Table.HeaderCell>SKU</Table.HeaderCell>
                            <Table.HeaderCell>Currency</Table.HeaderCell>
                            <Table.HeaderCell>Price</Table.HeaderCell>
                            <Table.HeaderCell>Min. Quantity</Table.HeaderCell>
                            <Table.HeaderCell>Max. Quantity</Table.HeaderCell>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {product.variants.map((variant) => {
                            if (variant.prices.length === 0) {
                              return (
                                <Table.Row key={variant.id}>
                                  <Table.Cell className="font-medium text-ui-fg-base">
                                    {variant.title || "Default Variant"}
                                  </Table.Cell>
                                  <Table.Cell className="text-ui-fg-subtle">
                                    {variant.sku || "-"}
                                  </Table.Cell>
                                  <Table.Cell className="text-ui-fg-muted italic">
                                    -
                                  </Table.Cell>
                                  <Table.Cell className="text-ui-fg-muted italic">
                                    No custom price
                                  </Table.Cell>
                                  <Table.Cell className="text-ui-fg-muted">
                                    -
                                  </Table.Cell>
                                  <Table.Cell className="text-ui-fg-muted">
                                    -
                                  </Table.Cell>
                                </Table.Row>
                              )
                            }

                            return variant.prices.map((price, idx) => (
                              <Table.Row
                                key={price.id || `${variant.id}-${idx}`}
                              >
                                <Table.Cell className="font-medium text-ui-fg-base">
                                  {variant.title || "Default Variant"}
                                </Table.Cell>
                                <Table.Cell className="text-ui-fg-subtle">
                                  {variant.sku || "-"}
                                </Table.Cell>
                                <Table.Cell>
                                  <Badge size="small">
                                    {price.currency_code.toUpperCase()}
                                  </Badge>
                                </Table.Cell>
                                <Table.Cell className="font-medium text-ui-fg-base">
                                  {formatCurrency(
                                    price.amount,
                                    price.currency_code
                                  )}
                                </Table.Cell>
                                <Table.Cell className="text-ui-fg-subtle">
                                  {price.min_quantity != null
                                    ? price.min_quantity
                                    : "-"}
                                </Table.Cell>
                                <Table.Cell className="text-ui-fg-subtle">
                                  {price.max_quantity != null
                                    ? price.max_quantity
                                    : "-"}
                                </Table.Cell>
                              </Table.Row>
                            ))
                          })}
                        </Table.Body>
                      </Table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Container>

      <PriceListPricesModal
        open={isPricesModalOpen}
        onOpenChange={setIsPricesModalOpen}
        priceList={priceList}
      />
    </>
  )
}
