"use client"

import {
  batchVendorPriceListPrices,
  listVendorProducts,
  type VendorPriceList,
  type VendorProduct,
} from "@lib/data/vendor-client"
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  FocusModal,
  Heading,
  Input,
  Label,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import { MagnifyingGlass } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

type PriceListPricesModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  priceList: VendorPriceList
  onSuccess?: () => void
}

type VariantPriceRow = {
  variant_id: string
  variant_title: string
  product_title: string
  currency_code: string
  amount: string
  min_quantity?: string
  max_quantity?: string
  existing_price_id?: string
}

export const PriceListPricesModal = ({
  open,
  onOpenChange,
  priceList,
  onSuccess,
}: PriceListPricesModalProps) => {
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [priceRows, setPriceRows] = useState<Record<string, VariantPriceRow>>({})
  const [currencyCode, setCurrencyCode] = useState("usd")

  // Fetch vendor products
  const { data: productsData, isLoading } = useQuery({
    queryKey: ["vendor-products", { limit: 100, offset: 0, q: search }],
    queryFn: () => listVendorProducts({ limit: 100, offset: 0, q: search || undefined }),
    enabled: open,
  })
  const products = productsData?.products ?? []

  const toggleProduct = (product: VendorProduct) => {
    const isSelected = selectedProductIds.includes(product.id)
    if (isSelected) {
      setSelectedProductIds(selectedProductIds.filter((id) => id !== product.id))
      const nextRows = { ...priceRows }
      for (const v of product.variants ?? []) {
        delete nextRows[v.id]
      }
      setPriceRows(nextRows)
    } else {
      setSelectedProductIds([...selectedProductIds, product.id])
      const nextRows = { ...priceRows }
      for (const v of product.variants ?? []) {
        if (!nextRows[v.id]) {
          nextRows[v.id] = {
            variant_id: v.id,
            variant_title: v.title || "Default Variant",
            product_title: product.title,
            currency_code: currencyCode,
            amount: "",
          }
        }
      }
      setPriceRows(nextRows)
    }
  }

  const handlePriceChange = (variantId: string, field: keyof VariantPriceRow, value: string) => {
    setPriceRows((prev) => ({
      ...prev,
      [variantId]: {
        ...prev[variantId],
        [field]: value,
      },
    }))
  }

  const batchMutation = useMutation({
    mutationFn: (createPrices: any[]) =>
      batchVendorPriceListPrices(priceList.id, { create: createPrices }),
    onSuccess: () => {
      toast.success("Prices added to price list")
      queryClient.invalidateQueries({
        queryKey: ["vendor-price-list", priceList.id],
      })
      queryClient.invalidateQueries({ queryKey: ["vendor-price-lists"] })
      onOpenChange(false)
      setSelectedProductIds([])
      setPriceRows({})
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add prices")
    },
  })

  const handleSubmit = () => {
    const createPrices = Object.values(priceRows)
      .filter((r) => r.amount && !isNaN(Number(r.amount)))
      .map((r) => ({
        variant_id: r.variant_id,
        currency_code: r.currency_code.toLowerCase(),
        amount: Math.round(Number(r.amount) * 100),
        min_quantity: r.min_quantity ? Number(r.min_quantity) : null,
        max_quantity: r.max_quantity ? Number(r.max_quantity) : null,
      }))

    if (!createPrices.length) {
      toast.error("Please specify at least one valid price")
      return
    }

    batchMutation.mutate(createPrices)
  }

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content className="flex flex-col">
        <FocusModal.Header className="flex items-center justify-between border-b p-4">
          <div>
            <FocusModal.Title asChild>
              <Heading level="h2">Add Products & Prices</Heading>
            </FocusModal.Title>
            <FocusModal.Description asChild>
              <Text size="small" className="text-ui-fg-subtle">
                Add products and define their prices for &ldquo;{priceList.title}&rdquo;.
              </Text>
            </FocusModal.Description>
          </div>

          <div className="flex items-center gap-x-2">
            <Button
              variant="secondary"
              size="small"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="small"
              onClick={handleSubmit}
              isLoading={batchMutation.isPending}
              disabled={Object.keys(priceRows).length === 0}
            >
              Save Prices
            </Button>
          </div>
        </FocusModal.Header>

        <FocusModal.Body className="flex flex-1 flex-col p-6 overflow-y-auto max-w-4xl mx-auto w-full gap-y-6">
          {/* Search and Products list */}
          <div className="flex flex-col gap-y-3">
            <Label size="small" weight="plus">
              Select Products
            </Label>
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-2.5 h-4 w-4 text-ui-fg-muted" />
              <Input
                placeholder="Search products to add..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="border rounded-lg max-h-48 overflow-y-auto divide-y">
              {isLoading ? (
                <div className="p-4 text-center text-ui-fg-subtle text-xs">
                  Loading products...
                </div>
              ) : products.length === 0 ? (
                <div className="p-4 text-center text-ui-fg-subtle text-xs">
                  No products found.
                </div>
              ) : (
                products.map((product) => {
                  const isSelected = selectedProductIds.includes(product.id)
                  return (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-3 hover:bg-ui-bg-subtle/50 cursor-pointer"
                      onClick={() => toggleProduct(product)}
                    >
                      <div className="flex items-center gap-x-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleProduct(product)}
                        />
                        {product.thumbnail && (
                          <img
                            src={product.thumbnail}
                            alt={product.title}
                            className="h-8 w-8 rounded object-cover border"
                          />
                        )}
                        <div>
                          <Text size="small" weight="plus">
                            {product.title}
                          </Text>
                          <Text size="xsmall" className="text-ui-fg-subtle">
                            {product.variants?.length ?? 0} variants
                          </Text>
                        </div>
                      </div>

                      {isSelected && (
                        <Badge size="small" color="green">
                          Selected
                        </Badge>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Price inputs table */}
          {selectedProductIds.length > 0 && (
            <div className="flex flex-col gap-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Heading level="h3" className="text-sm font-semibold">
                    Set Variant Prices ({Object.keys(priceRows).length})
                  </Heading>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Enter the custom prices for selected variants.
                  </Text>
                </div>

                <div className="flex items-center gap-x-2">
                  <Label size="xsmall" className="text-ui-fg-muted">
                    Currency:
                  </Label>
                  <Input
                    value={currencyCode.toUpperCase()}
                    onChange={(e) => setCurrencyCode(e.target.value.toLowerCase())}
                    className="w-20 uppercase font-mono text-xs"
                    maxLength={4}
                  />
                </div>
              </div>

              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell>Product / Variant</Table.HeaderCell>
                      <Table.HeaderCell className="w-24">Currency</Table.HeaderCell>
                      <Table.HeaderCell className="w-36">Price</Table.HeaderCell>
                      <Table.HeaderCell className="w-28">Min Qty</Table.HeaderCell>
                      <Table.HeaderCell className="w-28">Max Qty</Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {Object.entries(priceRows).map(([variantId, row]) => (
                      <Table.Row key={variantId}>
                        <Table.Cell>
                          <div>
                            <Text size="small" weight="plus">
                              {row.product_title}
                            </Text>
                            <Text size="xsmall" className="text-ui-fg-subtle font-mono">
                              {row.variant_title}
                            </Text>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <Input
                            value={row.currency_code.toUpperCase()}
                            onChange={(e) =>
                              handlePriceChange(
                                variantId,
                                "currency_code",
                                e.target.value.toLowerCase()
                              )
                            }
                            className="uppercase font-mono text-xs"
                            maxLength={4}
                          />
                        </Table.Cell>
                        <Table.Cell>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={row.amount}
                            onChange={(e) =>
                              handlePriceChange(variantId, "amount", e.target.value)
                            }
                            required
                          />
                        </Table.Cell>
                        <Table.Cell>
                          <Input
                            type="number"
                            min={1}
                            placeholder="None"
                            value={row.min_quantity || ""}
                            onChange={(e) =>
                              handlePriceChange(variantId, "min_quantity", e.target.value)
                            }
                          />
                        </Table.Cell>
                        <Table.Cell>
                          <Input
                            type="number"
                            min={1}
                            placeholder="None"
                            value={row.max_quantity || ""}
                            onChange={(e) =>
                              handlePriceChange(variantId, "max_quantity", e.target.value)
                            }
                          />
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </div>
            </div>
          )}
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}
