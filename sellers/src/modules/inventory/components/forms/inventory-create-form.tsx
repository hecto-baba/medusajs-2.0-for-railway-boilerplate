"use client"

import {
  createVendorInventoryItem,
  getVendorTaxonomy,
} from "@lib/data/vendor-client"
import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Switch,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

const Field = ({
  id,
  label,
  required,
  optional,
  hint,
  children,
}: {
  id?: string
  label: string
  required?: boolean
  optional?: boolean
  hint?: string
  children: React.ReactNode
}) => (
  <div className="flex flex-col gap-y-1.5">
    <div className="flex items-center justify-between">
      <Label htmlFor={id} size="small" weight="plus">
        {label} {required && <span className="text-ui-fg-error">*</span>}
      </Label>
      {optional && (
        <span className="text-ui-fg-muted txt-compact-xsmall">Optional</span>
      )}
    </div>
    {children}
    {hint && (
      <Text size="xsmall" className="text-ui-fg-subtle">
        {hint}
      </Text>
    )}
  </div>
)

export const InventoryCreateForm = () => {
  const router = useRouter()
  const queryClient = useQueryClient()

  // Form State
  const [title, setTitle] = useState("")
  const [sku, setSku] = useState("")
  const [description, setDescription] = useState("")
  const [requiresShipping, setRequiresShipping] = useState(true)

  // Dimensions & Customs
  const [width, setWidth] = useState("")
  const [length, setLength] = useState("")
  const [height, setHeight] = useState("")
  const [weight, setWeight] = useState("")
  const [originCountry, setOriginCountry] = useState("")
  const [material, setMaterial] = useState("")
  const [hsCode, setHsCode] = useState("")
  const [midCode, setMidCode] = useState("")

  // Location quantities
  const [locationQuantities, setLocationQuantities] = useState<
    Record<string, number>
  >({})

  const { data: taxonomy, isLoading: isLoadingTaxonomy } = useQuery({
    queryKey: ["vendor-taxonomy"],
    queryFn: getVendorTaxonomy,
  })

  const { mutateAsync: createItem, isPending } = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      createVendorInventoryItem(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-inventory-items"] })
      toast.success("Inventory item created successfully.")
      router.push(`/inventory/${data.inventory_item.id}`)
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create inventory item."
      )
    },
  })

  const handleLocationQtyChange = (locationId: string, qtyStr: string) => {
    const qty = parseInt(qtyStr)
    setLocationQuantities((prev) => {
      const next = { ...prev }
      if (isNaN(qty) || qty < 0) {
        delete next[locationId]
      } else {
        next[locationId] = qty
      }
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      toast.error("Please enter an item title.")
      return
    }

    const locationsPayload: Record<string, number> = {}
    for (const [locId, qty] of Object.entries(locationQuantities)) {
      if (typeof qty === "number" && qty >= 0) {
        locationsPayload[locId] = qty
      }
    }

    const num = (v: string) => (v.trim() === "" ? null : parseFloat(v))
    const txt = (v: string) => (v.trim() === "" ? null : v.trim())

    await createItem({
      title: title.trim(),
      sku: txt(sku),
      description: txt(description),
      hs_code: txt(hsCode),
      weight: num(weight),
      length: num(length),
      height: num(height),
      width: num(width),
      origin_country: txt(originCountry),
      mid_code: txt(midCode),
      material: txt(material),
      requires_shipping: requiresShipping,
      locations: Object.keys(locationsPayload).length
        ? locationsPayload
        : undefined,
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-y-6 pb-16">
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h1">New Inventory Item</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Create an inventory item to track stock and reservations across
            locations.
          </Text>
        </div>
        <div className="flex items-center gap-x-2">
          <Button variant="secondary" size="small" asChild>
            <Link href="/inventory">Cancel</Link>
          </Button>
          <Button size="small" onClick={handleSubmit} isLoading={isPending}>
            Create Item
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-y-6">
        {/* General Details */}
        <Container className="p-6">
          <Heading level="h2" className="mb-4">
            General Information
          </Heading>
          <div className="flex flex-col gap-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Title" required>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Cotton T-Shirt - Black / M"
                />
              </Field>

              <Field label="SKU (Stock Keeping Unit)" optional>
                <Input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="e.g. TSHIRT-BLK-M"
                />
              </Field>
            </div>

            <Field label="Description" optional>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Item description..."
                rows={3}
              />
            </Field>

            <div className="bg-ui-bg-subtle border-ui-border-base mt-2 flex items-center justify-between rounded-lg border p-3">
              <div>
                <Text size="small" weight="plus">
                  Requires Shipping
                </Text>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Indicate if this inventory item requires physical transport.
                </Text>
              </div>
              <Switch
                checked={requiresShipping}
                onCheckedChange={setRequiresShipping}
              />
            </div>
          </div>
        </Container>

        {/* Stock Availability */}
        <Container className="p-6">
          <Heading level="h2" className="mb-1">
            Stock Availability
          </Heading>
          <Text size="small" className="text-ui-fg-subtle mb-4">
            Optionally set starting stock quantities at your warehouse
            locations.
          </Text>

          {isLoadingTaxonomy ? (
            <Text size="small" className="text-ui-fg-subtle">
              Loading locations...
            </Text>
          ) : (taxonomy?.stock_locations ?? []).length === 0 ? (
            <Text size="small" className="text-ui-fg-subtle">
              No stock locations found in the system.
            </Text>
          ) : (
            <div className="border-ui-border-base divide-ui-border-base divide-y rounded-lg border">
              {(taxonomy?.stock_locations ?? []).map((loc) => (
                <div
                  key={loc.id}
                  className="flex items-center justify-between p-3"
                >
                  <div>
                    <Text size="small" weight="plus">
                      {loc.name}
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      ID: {loc.id}
                    </Text>
                  </div>
                  <div className="flex items-center gap-x-2">
                    <label className="text-ui-fg-subtle text-xs">
                      Initial Stock:
                    </label>
                    <Input
                      type="number"
                      min={0}
                      className="w-28 text-right"
                      placeholder="0"
                      value={locationQuantities[loc.id] ?? ""}
                      onChange={(e) =>
                        handleLocationQtyChange(loc.id, e.target.value)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Container>

        {/* Dimensions & Customs */}
        <Container className="p-6">
          <Heading level="h2" className="mb-4">
            Dimensions & Customs Attributes
          </Heading>
          <div className="flex flex-col gap-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Field label="Width (cm)" optional>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  placeholder="0"
                />
              </Field>
              <Field label="Length (cm)" optional>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                  placeholder="0"
                />
              </Field>
              <Field label="Height (cm)" optional>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="0"
                />
              </Field>
              <Field label="Weight (g)" optional>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="0"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Field label="Origin Country" optional>
                <Input
                  value={originCountry}
                  onChange={(e) => setOriginCountry(e.target.value)}
                  placeholder="e.g. US"
                  maxLength={2}
                />
              </Field>
              <Field label="Material" optional>
                <Input
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  placeholder="e.g. Cotton"
                />
              </Field>
              <Field label="HS Code" optional>
                <Input
                  value={hsCode}
                  onChange={(e) => setHsCode(e.target.value)}
                  placeholder="e.g. 6109.10"
                />
              </Field>
              <Field label="MID Code" optional>
                <Input
                  value={midCode}
                  onChange={(e) => setMidCode(e.target.value)}
                  placeholder="e.g. US12345"
                />
              </Field>
            </div>
          </div>
        </Container>

        <div className="flex items-center justify-end gap-x-2">
          <Button variant="secondary" size="small" asChild>
            <Link href="/inventory">Cancel</Link>
          </Button>
          <Button size="small" type="submit" isLoading={isPending}>
            Create Item
          </Button>
        </div>
      </form>
    </div>
  )
}
