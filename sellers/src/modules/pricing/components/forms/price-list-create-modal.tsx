"use client"

import {
  createVendorPriceList,
  listVendorCustomerGroups,
  listVendorProducts,
  type VendorProduct,
  type VendorCustomerGroup,
} from "@lib/data/vendor-client"
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  DatePicker,
  FocusModal,
  Heading,
  Input,
  Label,
  RadioGroup,
  Select,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import { ArrowLeft, ArrowRight, CurrencyDollar, MagnifyingGlass, Plus, Trash } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

type PriceListCreateModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (id: string) => void
}

type VariantPriceInput = {
  variant_id: string
  variant_title: string
  product_title: string
  currency_code: string
  amount: string
  min_quantity?: string
  max_quantity?: string
}

export const PriceListCreateModal = ({
  open,
  onOpenChange,
  onSuccess,
}: PriceListCreateModalProps) => {
  const queryClient = useQueryClient()

  // Steps: 1 = Details & Schedule, 2 = Customer Groups, 3 = Products & Prices
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step 1: Details
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState<"sale" | "override">("sale")
  const [status, setStatus] = useState<"active" | "draft">("active")
  const [startsAt, setStartsAt] = useState<Date | null>(null)
  const [endsAt, setEndsAt] = useState<Date | null>(null)

  // Step 2: Customer Groups
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])

  // Step 3: Products & Prices
  const [productSearch, setProductSearch] = useState("")
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [variantPrices, setVariantPrices] = useState<Record<string, VariantPriceInput>>({})
  const [defaultCurrency, setDefaultCurrency] = useState("usd")

  // Fetch customer groups
  const { data: groupsData } = useQuery({
    queryKey: ["vendor-customer-groups", { limit: 100, offset: 0 }],
    queryFn: () => listVendorCustomerGroups({ limit: 100, offset: 0 }),
    enabled: open,
  })
  const customerGroups = groupsData?.customer_groups ?? []

  // Fetch vendor products
  const { data: productsData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["vendor-products", { limit: 100, offset: 0, q: productSearch }],
    queryFn: () => listVendorProducts({ limit: 100, offset: 0, q: productSearch || undefined }),
    enabled: open && step === 3,
  })
  const products = productsData?.products ?? []

  const resetForm = () => {
    setStep(1)
    setTitle("")
    setDescription("")
    setType("sale")
    setStatus("active")
    setStartsAt(null)
    setEndsAt(null)
    setSelectedGroupIds([])
    setSelectedProductIds([])
    setVariantPrices({})
  }

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => createVendorPriceList(payload),
    onSuccess: (data) => {
      toast.success("Price list created successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-price-lists"] })
      onOpenChange(false)
      const createdId = data.price_list.id
      resetForm()
      onSuccess?.(createdId)
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create price list")
    },
  })

  const toggleGroup = (groupId: string) => {
    if (selectedGroupIds.includes(groupId)) {
      setSelectedGroupIds(selectedGroupIds.filter((id) => id !== groupId))
    } else {
      setSelectedGroupIds([...selectedGroupIds, groupId])
    }
  }

  const toggleProduct = (product: VendorProduct) => {
    const isSelected = selectedProductIds.includes(product.id)
    if (isSelected) {
      setSelectedProductIds(selectedProductIds.filter((id) => id !== product.id))
      // Remove variant prices for this product
      const nextPrices = { ...variantPrices }
      for (const variant of product.variants ?? []) {
        delete nextPrices[variant.id]
      }
      setVariantPrices(nextPrices)
    } else {
      setSelectedProductIds([...selectedProductIds, product.id])
      // Initialize variant prices
      const nextPrices = { ...variantPrices }
      for (const variant of product.variants ?? []) {
        if (!nextPrices[variant.id]) {
          nextPrices[variant.id] = {
            variant_id: variant.id,
            variant_title: variant.title || "Default Variant",
            product_title: product.title,
            currency_code: defaultCurrency,
            amount: "",
          }
        }
      }
      setVariantPrices(nextPrices)
    }
  }

  const handlePriceChange = (variantId: string, field: keyof VariantPriceInput, value: string) => {
    setVariantPrices((prev) => ({
      ...prev,
      [variantId]: {
        ...prev[variantId],
        [field]: value,
      },
    }))
  }

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error("Price list title is required")
      setStep(1)
      return
    }

    // Build prices array
    const pricesArray = Object.values(variantPrices)
      .filter((p) => p.amount && !isNaN(Number(p.amount)))
      .map((p) => ({
        variant_id: p.variant_id,
        currency_code: p.currency_code.toLowerCase(),
        amount: Math.round(Number(p.amount) * 100), // convert to smallest currency unit (cents)
        min_quantity: p.min_quantity ? Number(p.min_quantity) : null,
        max_quantity: p.max_quantity ? Number(p.max_quantity) : null,
      }))

    const rules: Record<string, string[]> = {}
    if (selectedGroupIds.length) {
      rules.customer_group_id = selectedGroupIds
    }

    const payload: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() || null,
      type,
      status,
      starts_at: startsAt ? startsAt.toISOString() : null,
      ends_at: endsAt ? endsAt.toISOString() : null,
      rules: Object.keys(rules).length ? rules : undefined,
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
      <FocusModal.Content className="flex flex-col">
        <FocusModal.Header className="flex items-center justify-between border-b p-4">
          <div>
            <FocusModal.Title asChild>
              <Heading level="h2">Create Price List</Heading>
            </FocusModal.Title>
            <FocusModal.Description asChild>
              <Text size="small" className="text-ui-fg-subtle">
                Step {step} of 3:{" "}
                {step === 1
                  ? "General Details & Schedule"
                  : step === 2
                  ? "Customer Groups & Customer Rules"
                  : "Products & Prices"}
              </Text>
            </FocusModal.Description>
          </div>

          <div className="flex items-center gap-x-2">
            <Button
              variant="secondary"
              size="small"
              onClick={() => {
                resetForm()
                onOpenChange(false)
              }}
            >
              Cancel
            </Button>

            {step > 1 && (
              <Button
                variant="secondary"
                size="small"
                onClick={() => setStep((s) => (s - 1) as any)}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
            )}

            {step < 3 ? (
              <Button
                variant="primary"
                size="small"
                onClick={() => {
                  if (step === 1 && !title.trim()) {
                    toast.error("Please enter a title for the price list")
                    return
                  }
                  setStep((s) => (s + 1) as any)
                }}
              >
                Next
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                variant="primary"
                size="small"
                onClick={handleSubmit}
                isLoading={createMutation.isPending}
              >
                Create Price List
              </Button>
            )}
          </div>
        </FocusModal.Header>

        <FocusModal.Body className="flex flex-1 flex-col p-6 overflow-y-auto max-w-3xl mx-auto w-full">
          {/* STEP 1: General Details */}
          {step === 1 && (
            <div className="flex flex-col gap-y-6">
              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Title <span className="text-ui-fg-error">*</span>
                </Label>
                <Input
                  placeholder="e.g. Summer Sale, VIP Exclusive Discount, Wholesale Tier 1"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Description
                </Label>
                <Input
                  placeholder="Describe the purpose or terms of this price list..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-y-2">
                  <Label size="small" weight="plus">
                    Price List Type
                  </Label>
                  <RadioGroup
                    value={type}
                    onValueChange={(val: any) => setType(val)}
                    className="flex flex-col gap-y-2"
                  >
                    <div className="flex items-start gap-x-3 rounded-lg border p-3 hover:bg-ui-bg-subtle cursor-pointer">
                      <RadioGroup.Item value="sale" id="type-sale" className="mt-0.5" />
                      <label htmlFor="type-sale" className="cursor-pointer">
                        <Text size="small" weight="plus">
                          Sale
                        </Text>
                        <Text size="xsmall" className="text-ui-fg-subtle">
                          Promotional sale prices shown with strikethrough original prices.
                        </Text>
                      </label>
                    </div>

                    <div className="flex items-start gap-x-3 rounded-lg border p-3 hover:bg-ui-bg-subtle cursor-pointer">
                      <RadioGroup.Item value="override" id="type-override" className="mt-0.5" />
                      <label htmlFor="type-override" className="cursor-pointer">
                        <Text size="small" weight="plus">
                          Override
                        </Text>
                        <Text size="xsmall" className="text-ui-fg-subtle">
                          Completely replaces product prices without strikethrough (e.g. wholesale catalog).
                        </Text>
                      </label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="flex flex-col gap-y-2">
                  <Label size="small" weight="plus">
                    Initial Status
                  </Label>
                  <RadioGroup
                    value={status}
                    onValueChange={(val: any) => setStatus(val)}
                    className="flex flex-col gap-y-2"
                  >
                    <div className="flex items-start gap-x-3 rounded-lg border p-3 hover:bg-ui-bg-subtle cursor-pointer">
                      <RadioGroup.Item value="active" id="status-active" className="mt-0.5" />
                      <label htmlFor="status-active" className="cursor-pointer">
                        <Text size="small" weight="plus">
                          Active
                        </Text>
                        <Text size="xsmall" className="text-ui-fg-subtle">
                          The price list applies immediately (or when the start date arrives).
                        </Text>
                      </label>
                    </div>

                    <div className="flex items-start gap-x-3 rounded-lg border p-3 hover:bg-ui-bg-subtle cursor-pointer">
                      <RadioGroup.Item value="draft" id="status-draft" className="mt-0.5" />
                      <label htmlFor="status-draft" className="cursor-pointer">
                        <Text size="small" weight="plus">
                          Draft
                        </Text>
                        <Text size="xsmall" className="text-ui-fg-subtle">
                          Saved as a draft and not applied to live customer carts.
                        </Text>
                      </label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              <div className="border-t pt-4">
                <Heading level="h3" className="text-sm font-semibold mb-1">
                  Validity Period (Optional)
                </Heading>
                <Text size="xsmall" className="text-ui-fg-subtle mb-4">
                  Leave empty if you want this price list to remain active indefinitely.
                </Text>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-y-2">
                    <Label size="small" weight="plus">
                      Start Date
                    </Label>
                    <DatePicker
                      value={startsAt ?? undefined}
                      onChange={(date) => setStartsAt(date ?? null)}
                    />
                  </div>

                  <div className="flex flex-col gap-y-2">
                    <Label size="small" weight="plus">
                      End Date
                    </Label>
                    <DatePicker
                      value={endsAt ?? undefined}
                      onChange={(date) => setEndsAt(date ?? null)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Customer Groups Rules */}
          {step === 2 && (
            <div className="flex flex-col gap-y-4">
              <div>
                <Heading level="h3" className="text-base font-semibold">
                  Customer Group Rules
                </Heading>
                <Text size="small" className="text-ui-fg-subtle">
                  Restrict this price list to specific customer groups (e.g. VIP, Wholesale). If no groups are selected, this price list will be available to all customers.
                </Text>
              </div>

              {customerGroups.length === 0 ? (
                <div className="border rounded-lg p-8 text-center bg-ui-bg-subtle">
                  <Text size="small" className="text-ui-fg-subtle">
                    You have not created any customer groups yet. You can proceed without groups, or create customer groups under Customers &gt; Groups.
                  </Text>
                </div>
              ) : (
                <div className="border rounded-lg divide-y overflow-hidden">
                  {customerGroups.map((group) => {
                    const isChecked = selectedGroupIds.includes(group.id)
                    return (
                      <div
                        key={group.id}
                        className="flex items-center justify-between p-4 hover:bg-ui-bg-subtle/50 cursor-pointer"
                        onClick={() => toggleGroup(group.id)}
                      >
                        <div className="flex items-center gap-x-3">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => toggleGroup(group.id)}
                          />
                          <div>
                            <Text size="small" weight="plus">
                              {group.name}
                            </Text>
                            <Text size="xsmall" className="text-ui-fg-subtle">
                              {group.customers_count ?? group.customers?.length ?? 0} members
                            </Text>
                          </div>
                        </div>

                        {isChecked && (
                          <Badge size="small" color="blue">
                            Selected
                          </Badge>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Products & Prices */}
          {step === 3 && (
            <div className="flex flex-col gap-y-6">
              <div>
                <Heading level="h3" className="text-base font-semibold">
                  Select Products & Set Variant Prices
                </Heading>
                <Text size="small" className="text-ui-fg-subtle">
                  Select products from your store and define custom price overrides or discounts.
                </Text>
              </div>

              {/* Product Selector */}
              <div className="flex flex-col gap-y-3">
                <div className="relative">
                  <MagnifyingGlass className="absolute left-3 top-2.5 h-4 w-4 text-ui-fg-muted" />
                  <Input
                    placeholder="Search your products..."
                    className="pl-9"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                </div>

                <div className="border rounded-lg max-h-56 overflow-y-auto divide-y">
                  {isLoadingProducts ? (
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

              {/* Price Inputs per Variant */}
              {selectedProductIds.length > 0 && (
                <div className="flex flex-col gap-y-3 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Heading level="h3" className="text-sm font-semibold">
                        Configure Variant Prices ({Object.keys(variantPrices).length})
                      </Heading>
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        Specify the custom price for each variant.
                      </Text>
                    </div>

                    <div className="flex items-center gap-x-2">
                      <Label size="xsmall" className="text-ui-fg-muted">
                        Currency:
                      </Label>
                      <Input
                        value={defaultCurrency.toUpperCase()}
                        onChange={(e) => setDefaultCurrency(e.target.value.toLowerCase())}
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
                          <Table.HeaderCell className="w-36">Price ({defaultCurrency.toUpperCase()})</Table.HeaderCell>
                          <Table.HeaderCell className="w-28">Min Qty</Table.HeaderCell>
                          <Table.HeaderCell className="w-28">Max Qty</Table.HeaderCell>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {Object.entries(variantPrices).map(([variantId, priceData]) => (
                          <Table.Row key={variantId}>
                            <Table.Cell>
                              <div>
                                <Text size="small" weight="plus">
                                  {priceData.product_title}
                                </Text>
                                <Text size="xsmall" className="text-ui-fg-subtle font-mono">
                                  {priceData.variant_title}
                                </Text>
                              </div>
                            </Table.Cell>
                            <Table.Cell>
                              <Input
                                value={priceData.currency_code.toUpperCase()}
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
                                value={priceData.amount}
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
                                value={priceData.min_quantity || ""}
                                onChange={(e) =>
                                  handlePriceChange(
                                    variantId,
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
                                placeholder="None"
                                value={priceData.max_quantity || ""}
                                onChange={(e) =>
                                  handlePriceChange(
                                    variantId,
                                    "max_quantity",
                                    e.target.value
                                  )
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
            </div>
          )}
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}
