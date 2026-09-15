"use client"

import {
  createVendorPriceList,
  listVendorProducts,
  listVendorRegions,
  type VendorProduct,
  type VendorRegion,
} from "@lib/data/vendor-client"
import { Thumbnail } from "@modules/common"
import { MagnifyingGlass, XMarkMini } from "@medusajs/icons"
import {
  Badge,
  Button,
  Checkbox,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  DatePicker,
  Divider,
  FocusModal,
  Heading,
  IconButton,
  Input,
  Label,
  ProgressStatus,
  ProgressTabs,
  RadioGroup,
  Select,
  Table,
  Text,
  Textarea,
  toast,
  useDataTable,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import {
  PriceListCustomerGroupRuleForm,
  type CustomerGroupItem,
} from "./price-list-customer-group-rule-form"

type PriceListCreateModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (id: string) => void
}

enum Tab {
  DETAIL = "detail",
  PRODUCT = "product",
  PRICE = "price",
}

type TabState = Record<Tab, ProgressStatus>

const initialTabState: TabState = {
  [Tab.DETAIL]: "in-progress",
  [Tab.PRODUCT]: "not-started",
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

export const PriceListCreateModal = ({
  open,
  onOpenChange,
  onSuccess,
}: PriceListCreateModalProps) => {
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<Tab>(Tab.DETAIL)
  const [tabState, setTabState] = useState<TabState>(initialTabState)

  // Tab 1: Details
  const [type, setType] = useState<"sale" | "override">("sale")
  const [status, setStatus] = useState<"active" | "draft">("active")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [startsAt, setStartsAt] = useState<Date | null>(null)
  const [endsAt, setEndsAt] = useState<Date | null>(null)
  const [customerGroups, setCustomerGroups] = useState<CustomerGroupItem[]>([])
  const [isCgModalOpen, setIsCgModalOpen] = useState(false)

  // Tab 2: Products
  const [productSearch, setProductSearch] = useState("")
  const [productPagination, setProductPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [selectedProducts, setSelectedProducts] = useState<VendorProduct[]>([])

  // Tab 3: Prices
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

  // Fetch products for tab 2
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
    setTab(Tab.DETAIL)
    setTabState(initialTabState)
    setType("sale")
    setStatus("active")
    setTitle("")
    setDescription("")
    setStartsAt(null)
    setEndsAt(null)
    setCustomerGroups([])
    setSelectedProducts([])
    setPricesState({})
    setIsCgModalOpen(false)
  }

  // Handle product selection changes
  const toggleProduct = (product: VendorProduct) => {
    const isSelected = selectedProducts.some((p) => p.id === product.id)
    if (isSelected) {
      setSelectedProducts((prev) => prev.filter((p) => p.id !== product.id))
      // Remove variant prices for unselected product
      setPricesState((prev) => {
        const next = { ...prev }
        for (const variant of product.variants ?? []) {
          delete next[variant.id]
        }
        return next
      })
    } else {
      setSelectedProducts((prev) => [...prev, product])
      // Initialize variant prices
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

      // Initialize variant prices
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
      productColumnHelper.accessor("status", {
        header: "Status",
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

  // Price mutation
  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => createVendorPriceList(payload),
    onSuccess: ({ price_list }) => {
      toast.success(`Price list ${price_list.title} was successfully created.`)
      queryClient.invalidateQueries({ queryKey: ["vendor-price-lists"] })
      onOpenChange(false)
      const createdId = price_list.id
      resetForm()
      onSuccess?.(createdId)
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create price list")
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

  const validateTab = (currentTab: Tab): boolean => {
    if (currentTab === Tab.DETAIL) {
      if (!title.trim()) {
        toast.error("Title is required")
        return false
      }
      return true
    }
    if (currentTab === Tab.PRODUCT) {
      if (selectedProducts.length === 0) {
        toast.error("Please select at least one product")
        return false
      }
      return true
    }
    return true
  }

  const handleChangeTab = (nextTab: Tab) => {
    if (nextTab === tab) return

    const tabsOrder = [Tab.DETAIL, Tab.PRODUCT, Tab.PRICE]
    const currentIndex = tabsOrder.indexOf(tab)
    const nextIndex = tabsOrder.indexOf(nextTab)

    // If moving forward, validate current tab
    if (nextIndex > currentIndex) {
      if (!validateTab(tab)) return
    }

    setTabState((prev) => ({
      ...prev,
      [tab]: "completed",
      [nextTab]: "in-progress",
    }))
    setTab(nextTab)
  }

  const handleNext = () => {
    if (tab === Tab.DETAIL) {
      handleChangeTab(Tab.PRODUCT)
    } else if (tab === Tab.PRODUCT) {
      handleChangeTab(Tab.PRICE)
    }
  }

  const handleSubmit = () => {
    if (!title.trim()) {
      setTab(Tab.DETAIL)
      toast.error("Title is required")
      return
    }

    // Build prices payload
    const pricesArray = Object.values(pricesState)
      .filter((p) => p.amount && !isNaN(Number(p.amount)))
      .map((p) => ({
        variant_id: p.variant_id,
        currency_code: (p.currency_code || selectedCurrency).toLowerCase(),
        amount: Math.round(Number(p.amount) * 100), // convert to cents
        min_quantity: p.min_quantity ? Number(p.min_quantity) : null,
        max_quantity: p.max_quantity ? Number(p.max_quantity) : null,
      }))

    const rulesPayload = customerGroups.length
      ? { "customer.groups.id": customerGroups.map((g) => g.id) }
      : undefined

    const payload: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() || null,
      type,
      status,
      starts_at: startsAt ? startsAt.toISOString() : null,
      ends_at: endsAt ? endsAt.toISOString() : null,
      rules: rulesPayload,
      prices: pricesArray.length ? pricesArray : undefined,
    }

    createMutation.mutate(payload)
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
          {/* Header */}
          <FocusModal.Header className="flex items-center justify-between border-b px-6 py-3">
            <div className="flex w-full max-w-[600px]">
              <ProgressTabs.List className="grid w-full grid-cols-3">
                <ProgressTabs.Trigger
                  status={tabState.detail}
                  value={Tab.DETAIL}
                >
                  Details
                </ProgressTabs.Trigger>
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

          {/* Body */}
          <FocusModal.Body className="size-full overflow-hidden p-0">
            {/* TAB 1: DETAILS */}
            <ProgressTabs.Content
              value={Tab.DETAIL}
              className="size-full overflow-y-auto"
            >
              <div className="flex flex-col items-center">
                <div className="flex w-full max-w-[720px] flex-col gap-y-8 px-8 py-12">
                  <div>
                    <Heading level="h1">Create Price List</Heading>
                    <Text size="small" className="text-ui-fg-subtle">
                      Create a new price list to manage the prices of your products.
                    </Text>
                  </div>

                  {/* Type */}
                  <div className="flex flex-col gap-y-3">
                    <div>
                      <Label size="small" weight="plus">
                        Type
                      </Label>
                      <Text size="small" className="text-ui-fg-subtle">
                        Choose the type of price list you want to create.
                      </Text>
                    </div>

                    <RadioGroup
                      value={type}
                      onValueChange={(v: any) => setType(v)}
                      className="grid grid-cols-1 gap-4 md:grid-cols-2"
                    >
                      <RadioGroup.ChoiceBox
                        value="sale"
                        label="Sale"
                        description="Sale prices are temporary price changes for products."
                      />
                      <RadioGroup.ChoiceBox
                        value="override"
                        label="Override"
                        description="Overrides are usually used to create customer-specific prices."
                      />
                    </RadioGroup>
                  </div>

                  {/* Title & Status */}
                  <div className="flex flex-col gap-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="flex flex-col gap-y-2">
                        <Label size="small" weight="plus">
                          Title <span className="text-ui-fg-error">*</span>
                        </Label>
                        <Input
                          placeholder="e.g. Summer Sale"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          required
                        />
                      </div>

                      <div className="flex flex-col gap-y-2">
                        <Label size="small" weight="plus">
                          Status
                        </Label>
                        <Select
                          value={status}
                          onValueChange={(val: any) => setStatus(val)}
                        >
                          <Select.Trigger>
                            <Select.Value />
                          </Select.Trigger>
                          <Select.Content>
                            <Select.Item value="active">Active</Select.Item>
                            <Select.Item value="draft">Draft</Select.Item>
                          </Select.Content>
                        </Select>
                      </div>
                    </div>

                    <div className="flex flex-col gap-y-2">
                      <Label size="small" weight="plus">
                        Description
                      </Label>
                      <Textarea
                        placeholder="Description..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </div>
                  </div>

                  <Divider />

                  {/* Starts at */}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 items-center">
                    <div className="flex flex-col">
                      <Label size="small" weight="plus">
                        Price list has a start date?
                      </Label>
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        Schedule the price list to activate in the future.
                      </Text>
                    </div>
                    <DatePicker
                      granularity="minute"
                      shouldCloseOnSelect={false}
                      value={startsAt ?? undefined}
                      onChange={(d) => setStartsAt(d ?? null)}
                    />
                  </div>

                  <Divider />

                  {/* Ends at */}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 items-center">
                    <div className="flex flex-col">
                      <Label size="small" weight="plus">
                        Price list has an expiry date?
                      </Label>
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        Schedule the price list to deactivate in the future.
                      </Text>
                    </div>
                    <DatePicker
                      granularity="minute"
                      shouldCloseOnSelect={false}
                      value={endsAt ?? undefined}
                      onChange={(d) => setEndsAt(d ?? null)}
                    />
                  </div>

                  <Divider />

                  {/* Customer availability */}
                  <div className="flex flex-col gap-y-3">
                    <div>
                      <Label size="small" weight="plus">
                        Customer availability
                      </Label>
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        Choose which customer groups the price list should be applied to.
                      </Text>
                    </div>

                    <div className="bg-ui-bg-component shadow-elevation-card-rest rounded-xl p-2 flex flex-col gap-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-ui-fg-subtle text-xs">
                        <div className="bg-ui-bg-field shadow-borders-base rounded-md px-3 py-1.5 font-medium">
                          Customer groups
                        </div>
                        <div className="bg-ui-bg-field shadow-borders-base rounded-md px-3 py-1.5 font-medium">
                          In
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsCgModalOpen(true)}
                          className="bg-ui-bg-field hover:bg-ui-bg-field-hover shadow-borders-base text-ui-fg-muted text-xs flex flex-1 items-center gap-x-2 rounded-md px-3 py-2 outline-none transition-colors"
                        >
                          <MagnifyingGlass className="h-4 w-4" />
                          <span>Search for customer groups</span>
                        </button>
                        <Button
                          variant="secondary"
                          size="small"
                          type="button"
                          onClick={() => setIsCgModalOpen(true)}
                        >
                          Browse
                        </Button>
                      </div>

                      {customerGroups.length > 0 && (
                        <div className="flex flex-col gap-1.5 border-t border-dashed pt-2">
                          {customerGroups.map((cg, idx) => (
                            <div
                              key={cg.id}
                              className="bg-ui-bg-field-component shadow-borders-base flex items-center justify-between gap-2 rounded-md px-3 py-1 text-xs"
                            >
                              <Text size="small" weight="plus">
                                {cg.name}
                              </Text>
                              <IconButton
                                size="small"
                                variant="transparent"
                                type="button"
                                onClick={() =>
                                  setCustomerGroups((prev) =>
                                    prev.filter((_, i) => i !== idx)
                                  )
                                }
                              >
                                <XMarkMini className="h-4 w-4" />
                              </IconButton>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </ProgressTabs.Content>

            {/* TAB 2: PRODUCTS */}
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

            {/* TAB 3: PRICES */}
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

          {/* Footer */}
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
                onClick={handleNext}
              >
                Continue
              </Button>
            ) : (
              <Button
                variant="primary"
                size="small"
                type="button"
                onClick={handleSubmit}
                isLoading={createMutation.isPending}
              >
                Save
              </Button>
            )}
          </FocusModal.Footer>
        </ProgressTabs>

        {/* Stacked Customer Groups Modal */}
        {isCgModalOpen && (
          <FocusModal
            open={isCgModalOpen}
            onOpenChange={setIsCgModalOpen}
          >
            <FocusModal.Content className="flex flex-col">
              <FocusModal.Header className="flex items-center justify-between border-b px-6 py-4">
                <FocusModal.Title asChild>
                  <Heading level="h2">Choose customer groups</Heading>
                </FocusModal.Title>
              </FocusModal.Header>
              <FocusModal.Body className="p-0 flex-1 overflow-hidden">
                <PriceListCustomerGroupRuleForm
                  state={customerGroups}
                  setState={setCustomerGroups}
                  onClose={() => setIsCgModalOpen(false)}
                />
              </FocusModal.Body>
            </FocusModal.Content>
          </FocusModal>
        )}
      </FocusModal.Content>
    </FocusModal>
  )
}
