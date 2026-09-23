"use client"

import {
  batchVendorPriceListPrices,
  listVendorCollections,
  listVendorProductTypes,
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
  createDataTableFilterHelper,
  DataTable,
  DataTableFilteringState,
  DataTablePaginationState,
  DataTableSortingState,
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

const extractFilterVal = (val: any): string | undefined => {
  if (!val) return undefined
  if (typeof val === "string") return val
  if (Array.isArray(val)) return val[0]
  if (typeof val === "object") {
    const flat = Object.values(val).flat()
    return (flat[0] as string) || undefined
  }
  return undefined
}

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
  const [productFiltering, setProductFiltering] = useState<DataTableFilteringState>({})
  const [productSorting, setProductSorting] = useState<DataTableSortingState | null>(null)
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

  // Fetch collections & types for filter options
  const { data: collectionsData } = useQuery({
    queryKey: ["vendor-collections-filter"],
    queryFn: () => listVendorCollections({ limit: 100, offset: 0 }),
    enabled: open,
  })
  const { data: typesData } = useQuery({
    queryKey: ["vendor-types-filter"],
    queryFn: () => listVendorProductTypes({ limit: 100, offset: 0 }),
    enabled: open,
  })

  // Extract filter parameters
  const statusFilter = useMemo(() => {
    const val = productFiltering["status"]
    if (!val) return undefined
    if (Array.isArray(val)) return val
    if (typeof val === "object") {
      const flat = Object.values(val).flat()
      return flat.length ? (flat as string[]) : undefined
    }
    return typeof val === "string" ? [val] : undefined
  }, [productFiltering])

  const collectionFilter = useMemo(() => {
    return extractFilterVal(productFiltering["collection_id"])
  }, [productFiltering])

  const typeFilter = useMemo(() => {
    return extractFilterVal(productFiltering["type_id"])
  }, [productFiltering])

  const dateFilter = useMemo(() => {
    const val = extractFilterVal(productFiltering["created_at_gte"])
    if (!val) return undefined
    const now = new Date()
    if (val === "7d") {
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    }
    if (val === "30d") {
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    }
    if (val === "90d") {
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
    }
    return val
  }, [productFiltering])

  const productOrder = useMemo(() => {
    if (!productSorting) return undefined
    const prefix = productSorting.desc ? "-" : ""
    return `${prefix}${productSorting.id}`
  }, [productSorting])

  const pLimit = productPagination.pageSize
  const pOffset = productPagination.pageIndex * pLimit

  const { data: productsData, isLoading: isLoadingProducts } = useQuery({
    queryKey: [
      "vendor-products",
      {
        limit: pLimit,
        offset: pOffset,
        q: productSearch,
        status: statusFilter,
        collection_id: collectionFilter,
        type_id: typeFilter,
        created_at_gte: dateFilter,
        order: productOrder,
      },
    ],
    queryFn: () =>
      listVendorProducts({
        limit: pLimit,
        offset: pOffset,
        q: productSearch || undefined,
        status: statusFilter,
        collection_id: collectionFilter,
        type_id: typeFilter,
        created_at_gte: dateFilter,
        order: productOrder,
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
    setProductFiltering({})
    setProductSorting(null)
    setProductSearch("")
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

  // Synchronize variant prices for all selected products
  useEffect(() => {
    if (selectedProducts.length > 0) {
      setPricesState((prev) => {
        let changed = false
        const next = { ...prev }
        for (const prod of selectedProducts) {
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
              changed = true
            }
          }
        }
        return changed ? next : prev
      })
    }
  }, [selectedProducts, selectedCurrency])

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

  // Dynamic filter definitions
  const productFilterHelper = useMemo(
    () => createDataTableFilterHelper<VendorProduct>(),
    []
  )

  const productFilters = useMemo(() => {
    const list: any[] = [
      productFilterHelper.accessor("status", {
        label: "Status",
        type: "multiselect",
        options: [
          { label: "Draft", value: "draft" },
          { label: "Proposed", value: "proposed" },
          { label: "Published", value: "published" },
          { label: "Rejected", value: "rejected" },
        ],
      }),
    ]

    const collections = collectionsData?.collections ?? []
    if (collections.length > 0) {
      list.push(
        productFilterHelper.custom({
          id: "collection_id",
          label: "Collection",
          type: "select",
          options: collections.map((c) => ({
            label: c.title,
            value: c.id,
          })),
        })
      )
    }

    const types = typesData?.product_types ?? []
    if (types.length > 0) {
      list.push(
        productFilterHelper.custom({
          id: "type_id",
          label: "Type",
          type: "select",
          options: types.map((t) => ({
            label: t.value,
            value: t.id,
          })),
        })
      )
    }

    list.push(
      productFilterHelper.custom({
        id: "created_at_gte",
        label: "Date Created",
        type: "select",
        options: [
          { label: "Last 7 days", value: "7d" },
          { label: "Last 30 days", value: "30d" },
          { label: "Last 90 days", value: "90d" },
        ],
      })
    )

    return list
  }, [collectionsData, typesData, productFilterHelper])

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
      productColumnHelper.accessor("title", {
        id: "title",
        header: "Product",
        enableSorting: true,
        sortLabel: "Title",
        sortAscLabel: "A-Z",
        sortDescLabel: "Z-A",
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
      productColumnHelper.accessor("status", {
        id: "status",
        header: "Status",
        enableSorting: true,
        sortLabel: "Status",
        cell: ({ getValue }) => {
          const status = getValue()
          return (
            <Badge
              size="small"
              color={status === "published" ? "green" : "grey"}
            >
              {status === "published" ? "Published" : "Draft"}
            </Badge>
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
      productColumnHelper.accessor("created_at", {
        id: "created_at",
        header: "Created",
        enableSorting: true,
        sortLabel: "Created",
        sortAscLabel: "Oldest first",
        sortDescLabel: "Newest first",
        cell: ({ getValue }) =>
          new Date(getValue()).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
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
    onRowClick: (_event, row) => toggleProduct(row),
    pagination: {
      state: productPagination,
      onPaginationChange: setProductPagination,
    },
    search: {
      state: productSearch,
      onSearchChange: (value) => {
        setProductSearch(value)
        setProductPagination((prev) => ({ ...prev, pageIndex: 0 }))
      },
    },
    filters: productFilters,
    filtering: {
      state: productFiltering,
      onFilteringChange: (filters) => {
        setProductFiltering(filters)
        setProductPagination((prev) => ({ ...prev, pageIndex: 0 }))
      },
    },
    sorting: {
      state: productSorting,
      onSortingChange: setProductSorting,
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
                  <div className="flex items-center gap-x-2">
                    <DataTable.Search placeholder="Search products..." />
                    <DataTable.FilterMenu tooltip="Filter" />
                    <DataTable.SortingMenu tooltip="Sort" />
                  </div>
                  {selectedProducts.length > 0 && (
                    <div className="flex items-center gap-x-2">
                      <Badge size="small" color="blue">
                        {selectedProducts.length} selected
                      </Badge>
                      <Button
                        size="small"
                        variant="transparent"
                        type="button"
                        onClick={() => {
                          setSelectedProducts([])
                          setPricesState({})
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  )}
                </DataTable.Toolbar>
                <DataTable.FilterBar />
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
                  <div className="border rounded-lg p-12 text-center bg-ui-bg-subtle flex flex-col items-center gap-y-3">
                    <Text size="small" className="text-ui-fg-subtle">
                      No products selected. Please select products to configure their prices.
                    </Text>
                    <Button
                      size="small"
                      variant="secondary"
                      type="button"
                      onClick={() => setTab(Tab.PRODUCT)}
                    >
                      Select Products
                    </Button>
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
                {selectedProducts.length > 0
                  ? `Continue (${selectedProducts.length} selected)`
                  : "Continue"}
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
