"use client"

import {
  createVendorDraftOrder,
  listVendorCustomers,
  listVendorProducts,
  type VendorCustomer,
  type VendorProduct,
} from "@lib/data/vendor-client"
import {
  Button,
  FocusModal,
  Heading,
  Input,
  Label,
  Select,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import { Plus, Trash } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

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

  // Customer state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("guest")
  const [guestEmail, setGuestEmail] = useState("")

  // Shipping Address
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [address1, setAddress1] = useState("")
  const [city, setCity] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [countryCode, setCountryCode] = useState("us")

  // Items
  const [items, setItems] = useState<DraftItem[]>([])
  const [selectedProductVariant, setSelectedProductVariant] = useState<string>("")
  const [itemQuantity, setItemQuantity] = useState<number>(1)

  // Fetch customers
  const { data: customerData } = useQuery({
    queryKey: ["vendor-customers-for-draft"],
    queryFn: () => listVendorCustomers({ limit: 100, offset: 0 }),
    enabled: open,
  })

  // Fetch products with variants
  const { data: productData } = useQuery({
    queryKey: ["vendor-products-for-draft"],
    queryFn: () => listVendorProducts({ limit: 100, offset: 0 }),
    enabled: open,
  })

  const customers = customerData?.customers ?? []
  const products = productData?.products ?? []

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
        label: `${prod.title} - ${v.title || "Default Variant"} ($${price.toFixed(2)})`,
        price,
        productTitle: prod.title,
        variantTitle: v.title || "Default Variant",
      })
    })
  })

  const addItem = () => {
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
        quantity: itemQuantity,
        unit_price: found.price,
      },
    ])

    setSelectedProductVariant("")
    setItemQuantity(1)
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

  const total = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)

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

    const payload: Record<string, unknown> = {
      ...(customer_id ? { customer_id } : {}),
      email,
      currency_code: "usd",
      items: items.map((it) => ({
        variant_id: it.variant_id,
        title: it.title,
        quantity: it.quantity,
        unit_price: it.unit_price,
      })),
      shipping_address: {
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        address_1: address1.trim() || undefined,
        city: city.trim() || undefined,
        postal_code: postalCode.trim() || undefined,
        country_code: countryCode.toLowerCase(),
      },
      billing_address: {
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        address_1: address1.trim() || undefined,
        city: city.trim() || undefined,
        postal_code: postalCode.trim() || undefined,
        country_code: countryCode.toLowerCase(),
      },
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
              Create a custom draft order on behalf of a customer.
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
              Create Draft Order (${total.toFixed(2)})
            </Button>
          </div>
        </FocusModal.Header>

        <FocusModal.Body className="flex flex-1 flex-col gap-y-6 p-6 overflow-y-auto max-w-4xl mx-auto w-full">
          {/* Customer Selection */}
          <div className="flex flex-col gap-y-3 bg-ui-bg-subtle p-4 rounded-lg border border-ui-border-base">
            <Heading level="h3">1. Customer Details</Heading>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Existing Customer
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
                      }
                    }
                  }}
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Choose customer or guest checkout..." />
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
            </div>
          </div>

          {/* Line Items */}
          <div className="flex flex-col gap-y-3 bg-ui-bg-subtle p-4 rounded-lg border border-ui-border-base">
            <Heading level="h3">2. Items</Heading>
            <div className="flex flex-col sm:flex-row items-end gap-3">
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
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                />
              </div>

              <Button type="button" variant="secondary" onClick={addItem}>
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </div>

            {items.length > 0 && (
              <div className="border border-ui-border-base rounded-lg overflow-hidden mt-3">
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell>Item</Table.HeaderCell>
                      <Table.HeaderCell className="w-24">Qty</Table.HeaderCell>
                      <Table.HeaderCell className="w-32">Price ($)</Table.HeaderCell>
                      <Table.HeaderCell className="w-28 text-right">Total</Table.HeaderCell>
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
                          ${(item.quantity * item.unit_price).toFixed(2)}
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

          {/* Shipping Address */}
          <div className="flex flex-col gap-y-3 bg-ui-bg-subtle p-4 rounded-lg border border-ui-border-base">
            <Heading level="h3">3. Shipping & Delivery</Heading>
            <div className="grid grid-cols-2 gap-4">
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

              <div className="col-span-2 flex flex-col gap-y-2">
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
            </div>
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}
