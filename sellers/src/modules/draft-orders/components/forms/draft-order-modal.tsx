"use client"

import {
  createVendorDraftOrder,
  listVendorCustomers,
  listVendorProducts,
  listVendorRegions,
  listVendorSalesChannels,
  type VendorCustomer,
  type VendorProduct,
  type VendorRegion,
  type VendorSalesChannel,
} from "@lib/data/vendor-client"
import {
  Button,
  Checkbox,
  FocusModal,
  Heading,
  Input,
  Label,
  Select,
  Table,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { Plus, Trash } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"

type DraftOrderModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

type DraftItem = {
  variant_id?: string
  title: string
  quantity: number
  unit_price: number
}

export const DraftOrderModal = ({
  open,
  onOpenChange,
  onSuccess,
}: DraftOrderModalProps) => {
  const queryClient = useQueryClient()

  // General configuration
  const [selectedRegionId, setSelectedRegionId] = useState<string>("")
  const [selectedCurrency, setSelectedCurrency] = useState<string>("usd")
  const [selectedSalesChannelId, setSelectedSalesChannelId] = useState<string>("")

  // Customer state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("guest")
  const [guestEmail, setGuestEmail] = useState("")
  const [phone, setPhone] = useState("")

  // Shipping Address
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [address1, setAddress1] = useState("")
  const [city, setCity] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [countryCode, setCountryCode] = useState("us")

  // Billing Address
  const [sameAsShipping, setSameAsShipping] = useState(true)
  const [bFirstName, setBFirstName] = useState("")
  const [bLastName, setBLastName] = useState("")
  const [bAddress1, setBAddress1] = useState("")
  const [bCity, setBCity] = useState("")
  const [bPostalCode, setBPostalCode] = useState("")
  const [bCountryCode, setBCountryCode] = useState("us")
  const [bPhone, setBPhone] = useState("")

  // Items
  const [items, setItems] = useState<DraftItem[]>([])
  const [itemMode, setItemMode] = useState<"catalog" | "custom">("catalog")
  
  // Catalog Item Picker
  const [selectedProductVariant, setSelectedProductVariant] = useState<string>("")
  const [catalogQuantity, setCatalogQuantity] = useState<number>(1)

  // Custom Item Picker
  const [customTitle, setCustomTitle] = useState("")
  const [customPrice, setCustomPrice] = useState<number>(0)
  const [customQuantity, setCustomQuantity] = useState<number>(1)

  // Shipping & Notes
  const [shippingMethodName, setShippingMethodName] = useState("Standard Shipping")
  const [shippingCost, setShippingCost] = useState<number>(0)
  const [orderNote, setOrderNote] = useState("")

  // Data fetching
  const { data: customerData } = useQuery({
    queryKey: ["vendor-customers-for-draft"],
    queryFn: () => listVendorCustomers({ limit: 100, offset: 0 }),
    enabled: open,
  })

  const { data: productData } = useQuery({
    queryKey: ["vendor-products-for-draft"],
    queryFn: () => listVendorProducts({ limit: 100, offset: 0 }),
    enabled: open,
  })

  const { data: regionData } = useQuery({
    queryKey: ["vendor-regions-for-draft"],
    queryFn: () => listVendorRegions(),
    enabled: open,
  })

  const { data: salesChannelData } = useQuery({
    queryKey: ["vendor-sales-channels-for-draft"],
    queryFn: () => listVendorSalesChannels({ limit: 100, offset: 0 }),
    enabled: open,
  })

  const customers = customerData?.customers ?? []
  const products = productData?.products ?? []
  const regions = regionData?.regions ?? []
  const salesChannels = salesChannelData?.sales_channels ?? []

  // Initialize region & currency if available
  useEffect(() => {
    if (regions.length > 0 && !selectedRegionId) {
      setSelectedRegionId(regions[0].id)
      setSelectedCurrency(regions[0].currency_code?.toLowerCase() || "usd")
      if (regions[0].countries?.[0]?.iso_2) {
        setCountryCode(regions[0].countries[0].iso_2.toLowerCase())
        setBCountryCode(regions[0].countries[0].iso_2.toLowerCase())
      }
    }
  }, [regions, selectedRegionId])

  useEffect(() => {
    if (salesChannels.length > 0 && !selectedSalesChannelId) {
      setSelectedSalesChannelId(salesChannels[0].id)
    }
  }, [salesChannels, selectedSalesChannelId])

  // All available variants
  const variantOptions: {
    id: string
    label: string
    price: number
    productTitle: string
    variantTitle: string
  }[] = []

  products.forEach((prod) => {
    (prod.variants || []).forEach((v) => {
      const price = v.prices?.[0]?.amount ?? 0
      variantOptions.push({
        id: v.id,
        label: `${prod.title} - ${v.title || "Default Variant"} (${selectedCurrency.toUpperCase()} ${price.toFixed(2)})`,
        price,
        productTitle: prod.title,
        variantTitle: v.title || "Default Variant",
      })
    })
  })

  const handleAddCatalogItem = () => {
    if (!selectedProductVariant) {
      toast.error("Please select a product variant")
      return
    }

    const found = variantOptions.find((v) => v.id === selectedProductVariant)
    if (!found) return

    setItems([
      ...items,
      {
        variant_id: found.id,
        title: `${found.productTitle} (${found.variantTitle})`,
        quantity: catalogQuantity,
        unit_price: found.price,
      },
    ])

    setSelectedProductVariant("")
    setCatalogQuantity(1)
  }

  const handleAddCustomItem = () => {
    if (!customTitle.trim()) {
      toast.error("Please enter a title for the custom item")
      return
    }

    setItems([
      ...items,
      {
        title: customTitle.trim(),
        quantity: customQuantity,
        unit_price: Number(customPrice) || 0,
      },
    ])

    setCustomTitle("")
    setCustomPrice(0)
    setCustomQuantity(1)
  }

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx))
  }

  const updateItemQty = (idx: number, qty: number) => {
    if (qty < 1) return
    const next = [...items]
    next[idx].quantity = qty
    setItems(next)
  }

  const updateItemPrice = (idx: number, price: number) => {
    if (price < 0) return
    const next = [...items]
    next[idx].unit_price = price
    setItems(next)
  }

  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  )
  const total = subtotal + (Number(shippingCost) || 0)

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      createVendorDraftOrder(payload),
    onSuccess: () => {
      toast.success("Draft order created successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-draft-orders"] })
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create draft order")
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (items.length === 0) {
      toast.error("Please add at least one line item to the draft order")
      return
    }

    let email = guestEmail
    let customer_id: string | undefined = undefined

    if (selectedCustomerId !== "guest") {
      const c = customers.find((cust) => cust.id === selectedCustomerId)
      if (c) {
        email = c.email
        customer_id = c.id
      }
    }

    if (!email) {
      toast.error("Customer email is required")
      return
    }

    const shippingAddress = {
      first_name: firstName.trim() || undefined,
      last_name: lastName.trim() || undefined,
      phone: phone.trim() || undefined,
      address_1: address1.trim() || undefined,
      city: city.trim() || undefined,
      postal_code: postalCode.trim() || undefined,
      country_code: countryCode.toLowerCase(),
    }

    const billingAddress = sameAsShipping
      ? shippingAddress
      : {
          first_name: bFirstName.trim() || undefined,
          last_name: bLastName.trim() || undefined,
          phone: bPhone.trim() || undefined,
          address_1: bAddress1.trim() || undefined,
          city: bCity.trim() || undefined,
          postal_code: bPostalCode.trim() || undefined,
          country_code: bCountryCode.toLowerCase(),
        }

    const payload: Record<string, unknown> = {
      ...(customer_id ? { customer_id } : {}),
      email,
      currency_code: selectedCurrency.toLowerCase(),
      region_id: selectedRegionId || undefined,
      sales_channel_id: selectedSalesChannelId || undefined,
      items: items.map((it) => ({
        variant_id: it.variant_id,
        title: it.title,
        quantity: it.quantity,
        unit_price: it.unit_price,
      })),
      shipping_address: shippingAddress,
      billing_address: billingAddress,
      shipping_methods: shippingCost > 0 || shippingMethodName
        ? [
            {
              name: shippingMethodName.trim() || "Standard Shipping",
              amount: Number(shippingCost) || 0,
            },
          ]
        : undefined,
      metadata: orderNote ? { note: orderNote } : undefined,
    }

    mutation.mutate(payload)
  }

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content className="flex flex-col">
        <FocusModal.Header className="flex items-center justify-between border-b p-4">
          <div>
            <FocusModal.Title asChild>
              <Heading level="h2">Create Draft Order</Heading>
            </FocusModal.Title>
            <FocusModal.Description className="text-ui-fg-subtle text-sm">
              Configure order parameters, line items, shipping and billing destinations.
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
              onClick={handleSubmit}
            >
              Create Draft Order ({selectedCurrency.toUpperCase()}{" "}
              {total.toFixed(2)})
            </Button>
          </div>
        </FocusModal.Header>

        <FocusModal.Body className="flex flex-1 flex-col gap-y-6 p-6 overflow-y-auto max-w-4xl mx-auto w-full">
          {/* 1. Region, Currency & Sales Channel */}
          <div className="flex flex-col gap-y-3 bg-ui-bg-subtle p-4 rounded-lg border border-ui-border-base">
            <Heading level="h3">1. Order Context & Currency</Heading>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Region
                </Label>
                <Select
                  value={selectedRegionId}
                  onValueChange={(val) => {
                    setSelectedRegionId(val)
                    const reg = regions.find((r) => r.id === val)
                    if (reg?.currency_code) {
                      setSelectedCurrency(reg.currency_code.toLowerCase())
                    }
                  }}
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Select region..." />
                  </Select.Trigger>
                  <Select.Content>
                    {regions.map((r) => (
                      <Select.Item key={r.id} value={r.id}>
                        {r.name} ({r.currency_code.toUpperCase()})
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Currency
                </Label>
                <Select
                  value={selectedCurrency}
                  onValueChange={setSelectedCurrency}
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Currency..." />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="usd">USD ($)</Select.Item>
                    <Select.Item value="eur">EUR (€)</Select.Item>
                    <Select.Item value="gbp">GBP (£)</Select.Item>
                    <Select.Item value="cad">CAD ($)</Select.Item>
                    <Select.Item value="aud">AUD ($)</Select.Item>
                    <Select.Item value="inr">INR (₹)</Select.Item>
                  </Select.Content>
                </Select>
              </div>

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Sales Channel
                </Label>
                <Select
                  value={selectedSalesChannelId}
                  onValueChange={setSelectedSalesChannelId}
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Select sales channel..." />
                  </Select.Trigger>
                  <Select.Content>
                    {salesChannels.map((sc) => (
                      <Select.Item key={sc.id} value={sc.id}>
                        {sc.name}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
            </div>
          </div>

          {/* 2. Customer Selection */}
          <div className="flex flex-col gap-y-3 bg-ui-bg-subtle p-4 rounded-lg border border-ui-border-base">
            <Heading level="h3">2. Customer Details</Heading>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Customer
                </Label>
                <Select
                  value={selectedCustomerId}
                  onValueChange={(val) => {
                    setSelectedCustomerId(val)
                    if (val !== "guest") {
                      const c = customers.find((cust) => cust.id === val)
                      if (c) {
                        setFirstName(c.first_name || "")
                        setLastName(c.last_name || "")
                        setGuestEmail(c.email || "")
                        if (c.phone) setPhone(c.phone)
                      }
                    }
                  }}
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Choose customer or guest..." />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="guest">Guest Checkout</Select.Item>
                    {customers.map((c) => (
                      <Select.Item key={c.id} value={c.id}>
                        {[c.first_name, c.last_name].filter(Boolean).join(" ") ||
                          c.email}{" "}
                        ({c.email})
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Email Address <span className="text-ui-fg-error">*</span>
                </Label>
                <Input
                  type="email"
                  placeholder="customer@example.com"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Phone Number
                </Label>
                <Input
                  placeholder="+1 (555) 000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 3. Line Items */}
          <div className="flex flex-col gap-y-3 bg-ui-bg-subtle p-4 rounded-lg border border-ui-border-base">
            <div className="flex items-center justify-between">
              <Heading level="h3">3. Line Items</Heading>
              <div className="flex items-center gap-x-2">
                <Button
                  size="small"
                  variant={itemMode === "catalog" ? "primary" : "secondary"}
                  onClick={() => setItemMode("catalog")}
                >
                  Catalog Product
                </Button>
                <Button
                  size="small"
                  variant={itemMode === "custom" ? "primary" : "secondary"}
                  onClick={() => setItemMode("custom")}
                >
                  Custom Item
                </Button>
              </div>
            </div>

            {itemMode === "catalog" ? (
              <div className="flex flex-col sm:flex-row items-end gap-3 pt-2">
                <div className="flex flex-1 flex-col gap-y-2">
                  <Label size="small" weight="plus">
                    Select Product Variant
                  </Label>
                  <Select
                    value={selectedProductVariant}
                    onValueChange={setSelectedProductVariant}
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Choose a product variant..." />
                    </Select.Trigger>
                    <Select.Content>
                      {variantOptions.map((opt) => (
                        <Select.Item key={opt.id} value={opt.id}>
                          {opt.label}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>

                <div className="flex w-24 flex-col gap-y-2">
                  <Label size="small" weight="plus">
                    Quantity
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={catalogQuantity}
                    onChange={(e) =>
                      setCatalogQuantity(parseInt(e.target.value) || 1)
                    }
                  />
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleAddCatalogItem}
                >
                  <Plus className="h-4 w-4" />
                  Add Catalog Item
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-4 items-end gap-3 pt-2">
                <div className="col-span-2 flex flex-col gap-y-2">
                  <Label size="small" weight="plus">
                    Custom Item Title <span className="text-ui-fg-error">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. Custom service fee, Special modification"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-y-2">
                  <Label size="small" weight="plus">
                    Price ({selectedCurrency.toUpperCase()})
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={customPrice}
                    onChange={(e) =>
                      setCustomPrice(parseFloat(e.target.value) || 0)
                    }
                  />
                </div>

                <div className="flex items-end gap-x-2">
                  <div className="flex-1 flex flex-col gap-y-2">
                    <Label size="small" weight="plus">
                      Qty
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      value={customQuantity}
                      onChange={(e) =>
                        setCustomQuantity(parseInt(e.target.value) || 1)
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAddCustomItem}
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>
              </div>
            )}

            {items.length > 0 && (
              <div className="border border-ui-border-base rounded-lg overflow-hidden mt-3">
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell>Item</Table.HeaderCell>
                      <Table.HeaderCell className="w-24">Qty</Table.HeaderCell>
                      <Table.HeaderCell className="w-32">
                        Price ({selectedCurrency.toUpperCase()})
                      </Table.HeaderCell>
                      <Table.HeaderCell className="w-28 text-right">
                        Total
                      </Table.HeaderCell>
                      <Table.HeaderCell className="w-12"></Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {items.map((item, idx) => (
                      <Table.Row key={idx}>
                        <Table.Cell>
                          <Text size="small" weight="plus">
                            {item.title}
                          </Text>
                          {item.variant_id && (
                            <Text size="xsmall" className="text-ui-fg-muted">
                              ID: {item.variant_id}
                            </Text>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          <Input
                            type="number"
                            min={1}
                            size="small"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItemQty(idx, parseInt(e.target.value) || 1)
                            }
                          />
                        </Table.Cell>
                        <Table.Cell>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            size="small"
                            value={item.unit_price}
                            onChange={(e) =>
                              updateItemPrice(
                                idx,
                                parseFloat(e.target.value) || 0
                              )
                            }
                          />
                        </Table.Cell>
                        <Table.Cell className="text-right font-medium">
                          {selectedCurrency.toUpperCase()}{" "}
                          {(item.quantity * item.unit_price).toFixed(2)}
                        </Table.Cell>
                        <Table.Cell>
                          <Button
                            variant="transparent"
                            size="small"
                            onClick={() => removeItem(idx)}
                            className="text-ui-fg-muted hover:text-ui-fg-error"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </div>
            )}
          </div>

          {/* 4. Shipping Address */}
          <div className="flex flex-col gap-y-3 bg-ui-bg-subtle p-4 rounded-lg border border-ui-border-base">
            <Heading level="h3">4. Shipping Address</Heading>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  First Name
                </Label>
                <Input
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Last Name
                </Label>
                <Input
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>

              <div className="col-span-1 md:col-span-2 flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Address Line 1
                </Label>
                <Input
                  placeholder="123 Main Street, Suite 100"
                  value={address1}
                  onChange={(e) => setAddress1(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  City
                </Label>
                <Input
                  placeholder="New York"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Postal / ZIP Code
                </Label>
                <Input
                  placeholder="10001"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Country Code (2 letters)
                </Label>
                <Input
                  placeholder="us"
                  maxLength={2}
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value.toLowerCase())}
                />
              </div>
            </div>
          </div>

          {/* 5. Billing Address */}
          <div className="flex flex-col gap-y-3 bg-ui-bg-subtle p-4 rounded-lg border border-ui-border-base">
            <div className="flex items-center justify-between">
              <Heading level="h3">5. Billing Address</Heading>
              <div className="flex items-center gap-x-2">
                <Checkbox
                  id="same-as-shipping"
                  checked={sameAsShipping}
                  onCheckedChange={(val) => setSameAsShipping(Boolean(val))}
                />
                <Label htmlFor="same-as-shipping" size="small">
                  Same as shipping address
                </Label>
              </div>
            </div>

            {!sameAsShipping && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="flex flex-col gap-y-2">
                  <Label size="small" weight="plus">
                    Billing First Name
                  </Label>
                  <Input
                    placeholder="Jane"
                    value={bFirstName}
                    onChange={(e) => setBFirstName(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-y-2">
                  <Label size="small" weight="plus">
                    Billing Last Name
                  </Label>
                  <Input
                    placeholder="Doe"
                    value={bLastName}
                    onChange={(e) => setBLastName(e.target.value)}
                  />
                </div>

                <div className="col-span-1 md:col-span-2 flex flex-col gap-y-2">
                  <Label size="small" weight="plus">
                    Billing Address Line 1
                  </Label>
                  <Input
                    placeholder="456 Corporate Ave"
                    value={bAddress1}
                    onChange={(e) => setBAddress1(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-y-2">
                  <Label size="small" weight="plus">
                    City
                  </Label>
                  <Input
                    placeholder="San Francisco"
                    value={bCity}
                    onChange={(e) => setBCity(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-y-2">
                  <Label size="small" weight="plus">
                    Postal / ZIP Code
                  </Label>
                  <Input
                    placeholder="94105"
                    value={bPostalCode}
                    onChange={(e) => setBPostalCode(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-y-2">
                  <Label size="small" weight="plus">
                    Country Code (2 letters)
                  </Label>
                  <Input
                    placeholder="us"
                    maxLength={2}
                    value={bCountryCode}
                    onChange={(e) =>
                      setBCountryCode(e.target.value.toLowerCase())
                    }
                  />
                </div>

                <div className="flex flex-col gap-y-2">
                  <Label size="small" weight="plus">
                    Phone
                  </Label>
                  <Input
                    placeholder="+1 (555) 123-4567"
                    value={bPhone}
                    onChange={(e) => setBPhone(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 6. Shipping Method, Notes & Summary */}
          <div className="flex flex-col gap-y-3 bg-ui-bg-subtle p-4 rounded-lg border border-ui-border-base">
            <Heading level="h3">6. Shipping Method & Notes</Heading>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Shipping Method Name
                </Label>
                <Input
                  placeholder="Standard Shipping, Express Courier"
                  value={shippingMethodName}
                  onChange={(e) => setShippingMethodName(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Shipping Cost ({selectedCurrency.toUpperCase()})
                </Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={shippingCost}
                  onChange={(e) =>
                    setShippingCost(parseFloat(e.target.value) || 0)
                  }
                />
              </div>

              <div className="col-span-1 md:col-span-2 flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Order Notes / Instructions
                </Label>
                <Textarea
                  placeholder="Add internal notes or customer-facing order remarks..."
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            {/* Financial Summary */}
            <div className="mt-4 pt-4 border-t border-ui-border-base flex flex-col gap-y-2 max-w-xs ml-auto text-right">
              <div className="flex justify-between text-sm text-ui-fg-subtle">
                <span>Subtotal</span>
                <span>
                  {selectedCurrency.toUpperCase()} {subtotal.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm text-ui-fg-subtle">
                <span>Shipping</span>
                <span>
                  {selectedCurrency.toUpperCase()}{" "}
                  {Number(shippingCost).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-base font-semibold text-ui-fg-base border-t border-ui-border-base pt-2">
                <span>Total</span>
                <span>
                  {selectedCurrency.toUpperCase()} {total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}
