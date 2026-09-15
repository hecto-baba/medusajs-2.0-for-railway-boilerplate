"use client"

import {
  batchVendorPriceListPrices,
  listVendorProducts,
  listVendorRegions,
  type VendorPriceList,
  type VendorProduct,
} from "@lib/data/vendor-client"
import { Thumbnail } from "@modules/common"
import {
  Badge,
  Button,
  Checkbox,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  FocusModal,
  Heading,
  Input,
  Label,
  ProgressStatus,
  ProgressTabs,
  Select,
  Table,
  Text,
  toast,
  useDataTable,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"

type PriceListPricesAddModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  priceList: VendorPriceList
  onSuccess?: () => void
}

enum Tab {
  PRODUCT = "product",
  PRICE = "price",
}

type TabState = Record<Tab, ProgressStatus>

const initialTabState: TabState = {
  [Tab.PRODUCT]: "in-progress",
  [Tab.PRICE]: "not-started",
}

type VariantPriceState = {
  variant_id: string
  variant_title: string
  product_id: string
  product_title: string
  currency_code: string
  amount: string
  min_quantity?: string
  max_quantity?: string
}

const productColumnHelper = createDataTableColumnHelper<VendorProduct>()

export const PriceListPricesAddModal = ({
  open,
  onOpenChange,
  priceList,
  onSuccess,
}: PriceListPricesAddModalProps) => {
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<Tab>(Tab.PRODUCT)
  const [tabState, setTabState] = useState<TabState>(initialTabState)

  const [productSearch, setProductSearch] = useState("")
  const [productPagination, setProductPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [selectedProducts, setSelectedProducts] = useState<VendorProduct[]>([])

  const [selectedCurrency, setSelectedCurrency] = useState("usd")
  const [pricesState, setPricesState] = useState<Record<string, VariantPriceState>>({})

  // Fetch regions for store currencies
  const { data: regionsData } = useQuery({
    queryKey: ["vendor-regions"],
    queryFn: () => listVendorRegions(),
    enabled: open,
  })
  const regions = regionsData?.regions ?? []

  const availableCurrencies = useMemo(() => {
    const list = new Set<string>()
    for (const r of regions) {
      if (r.currency_code) list.add(r.currency_code.toLowerCase())
    }
    if (!list.size) list.add("usd")
    return Array.from(list)
  }, [regions])

  useEffect(() => {
    if (availableCurrencies.length && !availableCurrencies.includes(selectedCurrency)) {
      setSelectedCurrency(availableCurrencies[0])
    }
  }, [availableCurrencies, selectedCurrency])

  const pLimit = productPagination.pageSize
  const pOffset = productPagination.pageIndex * pLimit

  const { data: productsData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["vendor-products", { limit: pLimit, offset: pOffset, q: productSearch }],
    queryFn: () =>
      listVendorProducts({
        limit: pLimit,
        offset: pOffset,
        q: productSearch || undefined,
      }),
    enabled: open,
  })
  const products = productsData?.products ?? []
  const productsCount = productsData?.count ?? 0

  const resetForm = () => {
    setTab(Tab.PRODUCT)
    setTabState(initialTabState)
    setSelectedProducts([])
    setPricesState({})
  }

  const toggleProduct = (product: VendorProduct) => {
    const isSelected = selectedProducts.some((p) => p.id === product.id)
    if (isSelected) {
      setSelectedProducts((prev) => prev.filter((p) => p.id !== product.id))
      setPricesState((prev) => {
        const next = { ...prev }
        for (const variant of product.variants ?? []) {
          delete next[variant.id]
        }
        return next
      })
    } else {
      setSelectedProducts((prev) => [...prev, product])
      setPricesState((prev) => {
        const next = { ...prev }
        for (const variant of product.variants ?? []) {
          if (!next[variant.id]) {
            next[variant.id] = {
              variant_id: variant.id,
              variant_title: variant.title || "Default Variant",
              product_id: product.id,
              product_title: product.title,
              currency_code: selectedCurrency,
              amount: "",
            }
          }
        }
        return next
      })
    }
  }

  const handleSelectAllProducts = (checked: boolean) => {
    if (checked) {
      const combined = [...selectedProducts]
      for (const p of products) {
        if (!combined.some((item) => item.id === p.id)) {
          combined.push(p)
        }
      }
      setSelectedProducts(combined)

      setPricesState((prev) => {
        const next = { ...prev }
        for (const prod of products) {
          for (const variant of prod.variants ?? []) {
            if (!next[variant.id]) {
              next[variant.id] = {
                variant_id: variant.id,
                variant_title: variant.title || "Default Variant",
                product_id: prod.id,
                product_title: prod.title,
                currency_code: selectedCurrency,
                amount: "",
              }
            }
          }
        }
        return next
      })
    } else {
      const pageIds = products.map((p) => p.id)
      setSelectedProducts((prev) => prev.filter((p) => !pageIds.includes(p.id)))
    }
  }

  const allPageProductsSelected =
    products.length > 0 &&
    products.every((p) => selectedProducts.some((s) => s.id === p.id))

  const somePageProductsSelected =
    products.some((p) => selectedProducts.some((s) => s.id === p.id)) &&
    !allPageProductsSelected

  const productColumns = useMemo(
    () => [
      productColumnHelper.display({
        id: "select",
        header: () => (
          <Checkbox
            checked={
              allPageProductsSelected
                ? true
                : somePageProductsSelected
                ? "indeterminate"
                : false
            }
            onCheckedChange={(checked) => handleSelectAllProducts(!!checked)}
          />
        ),
        cell: ({ row }) => {
          const product = row.original
          const isSelected = selectedProducts.some((p) => p.id === product.id)
          return (
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => toggleProduct(product)}
              onClick={(e) => e.stopPropagation()}
            />
          )
        },
      }),
      productColumnHelper.display({
        id: "product",
        header: "Product",
        cell: ({ row }) => {
          const prod = row.original
          return (
            <div className="flex items-center gap-x-3">
              <Thumbnail src={prod.thumbnail} />
              <div className="flex flex-col">
                <Text size="small" weight="plus">
                  {prod.title}
                </Text>
                {prod.collection && (
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {prod.collection.title}
                  </Text>
                )}
              </div>
            </div>
          )
        },
      }),
      productColumnHelper.accessor("variants", {
        header: "Variants",
        cell: ({ getValue }) => {
          const count = getValue()?.length ?? 0
          return (
            <Text size="small" className="text-ui-fg-subtle">
              {count} {count === 1 ? "variant" : "variants"}
            </Text>
          )
        },
      }),
    ],
    [selectedProducts, products, allPageProductsSelected, somePageProductsSelected]
  )

  const productTable = useDataTable({
    data: products,
    columns: productColumns,
    rowCount: productsCount,
    getRowId: (row) => row.id,
    isLoading: isLoadingProducts,
    pagination: {
      state: productPagination,
      onPaginationChange: setProductPagination,
    },
    search: {
      state: productSearch,
      onSearchChange: setProductSearch,
    },
  })

  const batchMutation = useMutation({
    mutationFn: (createPrices: any[]) =>
      batchVendorPriceListPrices(priceList.id, { create: createPrices }),
    onSuccess: () => {
      toast.success("Prices were successfully added to the price list.")
      queryClient.invalidateQueries({
        queryKey: ["vendor-price-list", priceList.id],
      })
      queryClient.invalidateQueries({ queryKey: ["vendor-price-lists"] })
      onOpenChange(false)
      resetForm()
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add prices")
    },
  })

  const handlePriceFieldChange = (
    variantId: string,
    field: keyof VariantPriceState,
    val: string
  ) => {
    setPricesState((prev) => ({
      ...prev,
      [variantId]: {
        ...prev[variantId],
        [field]: val,
      },
    }))
  }

  const handleChangeTab = (nextTab: Tab) => {
    if (nextTab === tab) return

    if (nextTab === Tab.PRICE && selectedProducts.length === 0) {
      toast.error("Please select at least one product")
      return
    }

    setTabState((prev) => ({
      ...prev,
      [tab]: "completed",
      [nextTab]: "in-progress",
    }))
    setTab(nextTab)
  }

  const handleSubmit = () => {
    const createPrices = Object.values(pricesState)
      .filter((p) => p.amount && !isNaN(Number(p.amount)))
      .map((p) => ({
        variant_id: p.variant_id,
        currency_code: (p.currency_code || selectedCurrency).toLowerCase(),
        amount: Math.round(Number(p.amount) * 100),
        min_quantity: p.min_quantity ? Number(p.min_quantity) : null,
        max_quantity: p.max_quantity ? Number(p.max_quantity) : null,
      }))

    if (!createPrices.length) {
      toast.error("Please enter at least one valid price")
      return
    }

    batchMutation.mutate(createPrices)
  }

  return (
    <FocusModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) resetForm()
        onOpenChange(nextOpen)
      }}
    >
      <FocusModal.Content className="flex flex-col overflow-hidden">
        <ProgressTabs
          value={tab}
          onValueChange={(val) => handleChangeTab(val as Tab)}
          className="flex h-full flex-col overflow-hidden"
        >
          <FocusModal.Header className="flex items-center justify-between border-b px-6 py-3">
            <div className="flex w-full max-w-[400px]">
              <ProgressTabs.List className="grid w-full grid-cols-2">
                <ProgressTabs.Trigger
                  status={tabState.product}
                  value={Tab.PRODUCT}
                >
                  Products
                </ProgressTabs.Trigger>
                <ProgressTabs.Trigger
                  status={tabState.price}
                  value={Tab.PRICE}
                >
                  Prices
                </ProgressTabs.Trigger>
              </ProgressTabs.List>
            </div>
          </FocusModal.Header>

          <FocusModal.Body className="size-full overflow-hidden p-0">
            {/* TAB 1: PRODUCTS */}
            <ProgressTabs.Content
              value={Tab.PRODUCT}
              className="size-full overflow-hidden p-6"
            >
              <DataTable instance={productTable}>
                <DataTable.Toolbar className="flex items-center justify-between">
                  <DataTable.Search placeholder="Search products..." />
                </DataTable.Toolbar>
                <DataTable.Table />
                <DataTable.Pagination />
              </DataTable>
            </ProgressTabs.Content>

            {/* TAB 2: PRICES */}
            <ProgressTabs.Content
              value={Tab.PRICE}
              className="size-full overflow-y-auto p-6"
            >
              <div className="flex flex-col gap-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Heading level="h2">Price Overrides</Heading>
                    <Text size="small" className="text-ui-fg-subtle">
                      Configure custom prices for selected product variants.
                    </Text>
                  </div>

                  <div className="flex items-center gap-x-2">
                    <Label size="small" className="text-ui-fg-muted">
                      Currency:
                    </Label>
                    <Select
                      value={selectedCurrency}
                      onValueChange={(val) => setSelectedCurrency(val)}
                    >
                      <Select.Trigger className="w-28 uppercase font-mono">
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
                        {availableCurrencies.map((c) => (
                          <Select.Item key={c} value={c} className="uppercase font-mono">
                            {c.toUpperCase()}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </div>
                </div>

                {selectedProducts.length === 0 ? (
                  <div className="border rounded-lg p-12 text-center bg-ui-bg-subtle">
                    <Text size="small" className="text-ui-fg-subtle">
                      No products selected. Please go back to the Products tab and select products.
                    </Text>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-x-auto divide-y">
                    {selectedProducts.map((product) => (
                      <div key={product.id} className="flex flex-col">
                        <div className="flex items-center gap-x-3 p-3 bg-ui-bg-subtle/50">
                          <Thumbnail src={product.thumbnail} />
                          <Text size="small" weight="plus">
                            {product.title}
                          </Text>
                        </div>

                        <Table>
                          <Table.Header>
                            <Table.Row>
                              <Table.HeaderCell>Variant</Table.HeaderCell>
                              <Table.HeaderCell>SKU</Table.HeaderCell>
                              <Table.HeaderCell className="w-32">Currency</Table.HeaderCell>
                              <Table.HeaderCell className="w-40">Price</Table.HeaderCell>
                              <Table.HeaderCell className="w-28">Min Qty</Table.HeaderCell>
                              <Table.HeaderCell className="w-28">Max Qty</Table.HeaderCell>
                            </Table.Row>
                          </Table.Header>
                          <Table.Body>
                            {(product.variants ?? []).map((variant) => {
                              const priceRow = pricesState[variant.id] || {
                                variant_id: variant.id,
                                variant_title: variant.title || "Default Variant",
                                product_id: product.id,
                                product_title: product.title,
                                currency_code: selectedCurrency,
                                amount: "",
                              }

                              return (
                                <Table.Row key={variant.id}>
                                  <Table.Cell className="font-medium text-ui-fg-base text-sm">
                                    {variant.title || "Default Variant"}
                                  </Table.Cell>
                                  <Table.Cell className="text-ui-fg-subtle text-xs">
                                    {variant.sku || "-"}
                                  </Table.Cell>
                                  <Table.Cell>
                                    <Badge size="small" className="uppercase font-mono">
                                      {(priceRow.currency_code || selectedCurrency).toUpperCase()}
                                    </Badge>
                                  </Table.Cell>
                                  <Table.Cell>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      placeholder="0.00"
                                      value={priceRow.amount}
                                      onChange={(e) =>
                                        handlePriceFieldChange(
                                          variant.id,
                                          "amount",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </Table.Cell>
                                  <Table.Cell>
                                    <Input
                                      type="number"
                                      min={1}
                                      placeholder="-"
                                      value={priceRow.min_quantity || ""}
                                      onChange={(e) =>
                                        handlePriceFieldChange(
                                          variant.id,
                                          "min_quantity",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </Table.Cell>
                                  <Table.Cell>
                                    <Input
                                      type="number"
                                      min={1}
                                      placeholder="-"
                                      value={priceRow.max_quantity || ""}
                                      onChange={(e) =>
                                        handlePriceFieldChange(
                                          variant.id,
                                          "max_quantity",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </Table.Cell>
                                </Table.Row>
                              )
                            })}
                          </Table.Body>
                        </Table>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ProgressTabs.Content>
          </FocusModal.Body>

          <FocusModal.Footer className="flex items-center justify-end gap-x-2 border-t px-6 py-4">
            <Button
              variant="secondary"
              size="small"
              type="button"
              onClick={() => {
                resetForm()
                onOpenChange(false)
              }}
            >
              Cancel
            </Button>

            {tab !== Tab.PRICE ? (
              <Button
                variant="primary"
                size="small"
                type="button"
                onClick={() => handleChangeTab(Tab.PRICE)}
              >
                Continue
              </Button>
            ) : (
              <Button
                variant="primary"
                size="small"
                type="button"
                onClick={handleSubmit}
                isLoading={batchMutation.isPending}
              >
                Save
              </Button>
            )}
          </FocusModal.Footer>
        </ProgressTabs>
      </FocusModal.Content>
    </FocusModal>
  )
}
