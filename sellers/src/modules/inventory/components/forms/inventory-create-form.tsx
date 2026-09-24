"use client"

import {
  createVendorInventoryItem,
  getVendorTaxonomy,
  listVendorStockLocations,
} from "@lib/data/vendor-client"
import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Select,
  Switch,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

const COUNTRIES = [
  { label: "United States", value: "US" },
  { label: "United Kingdom", value: "GB" },
  { label: "Germany", value: "DE" },
  { label: "France", value: "FR" },
  { label: "India", value: "IN" },
  { label: "China", value: "CN" },
  { label: "Japan", value: "JP" },
  { label: "Canada", value: "CA" },
  { label: "Australia", value: "AU" },
  { label: "Italy", value: "IT" },
  { label: "Spain", value: "ES" },
  { label: "Netherlands", value: "NL" },
]

export const InventoryCreateForm = () => {
  const router = useRouter()
  const queryClient = useQueryClient()

  // Form State
  const [title, setTitle] = useState("")
  const [sku, setSku] = useState("")
  const [hsCode, setHsCode] = useState("")
  const [midCode, setMidCode] = useState("")
  const [originCountry, setOriginCountry] = useState("")
  const [material, setMaterial] = useState("")
  const [width, setWidth] = useState("")
  const [length, setLength] = useState("")
  const [height, setHeight] = useState("")
  const [weight, setWeight] = useState("")
  const [requiresShipping, setRequiresShipping] = useState(true)

  // Location quantities
  const [locationQuantities, setLocationQuantities] = useState<
    Record<string, number>
  >({})

  const { data: stockLocationsData, isLoading: isLoadingStockLocations } =
    useQuery({
      queryKey: ["vendor-stock-locations"],
      queryFn: () => listVendorStockLocations({ limit: 100, offset: 0 }),
    })

  const { data: taxonomy, isLoading: isLoadingTaxonomy } = useQuery({
    queryKey: ["vendor-taxonomy"],
    queryFn: getVendorTaxonomy,
  })

  const stockLocations =
    stockLocationsData?.stock_locations &&
    stockLocationsData.stock_locations.length > 0
      ? stockLocationsData.stock_locations
      : taxonomy?.stock_locations ?? []

  const isLoadingLocations = isLoadingStockLocations && isLoadingTaxonomy

  const { mutateAsync: createItem, isPending } = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      createVendorInventoryItem(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-inventory-items"] })
      toast.success("Inventory item was successfully created.")
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

    const locationsPayload: Record<string, number> = {}
    for (const [locId, qty] of Object.entries(locationQuantities)) {
      if (typeof qty === "number" && qty >= 0) {
        locationsPayload[locId] = qty
      }
    }

    const num = (v: string) => (v.trim() === "" ? null : parseFloat(v))
    const txt = (v: string) => (v.trim() === "" ? null : v.trim())

    await createItem({
      title: txt(title),
      sku: txt(sku),
      hs_code: txt(hsCode),
      mid_code: txt(midCode),
      origin_country: txt(originCountry),
      material: txt(material),
      weight: num(weight),
      length: num(length),
      height: num(height),
      width: num(width),
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
          <Heading level="h1">Create Inventory Item</Heading>
        </div>
        <div className="flex items-center gap-x-2">
          <Button variant="secondary" size="small" asChild>
            <Link href="/inventory">Cancel</Link>
          </Button>
          <Button size="small" onClick={handleSubmit} isLoading={isPending}>
            Create
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-y-6">
        {/* Details */}
        <Container className="p-6">
          <Heading level="h2" className="mb-4">
            Details
          </Heading>
          <div className="flex flex-col gap-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-y-1.5">
                <Label size="small" weight="plus">
                  Title
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-y-1.5">
                <Label size="small" weight="plus">
                  SKU
                </Label>
                <Input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-y-1.5">
                <Label size="small" weight="plus">
                  HS Code
                </Label>
                <Input
                  value={hsCode}
                  onChange={(e) => setHsCode(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-y-1.5">
                <Label size="small" weight="plus">
                  MID Code
                </Label>
                <Input
                  value={midCode}
                  onChange={(e) => setMidCode(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-y-1.5">
                <Label size="small" weight="plus">
                  Country of origin
                </Label>
                <Select
                  value={originCountry}
                  onValueChange={setOriginCountry}
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Select a country" />
                  </Select.Trigger>
                  <Select.Content>
                    {COUNTRIES.map((c) => (
                      <Select.Item key={c.value} value={c.value}>
                        {c.label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>

              <div className="flex flex-col gap-y-1.5">
                <Label size="small" weight="plus">
                  Material
                </Label>
                <Input
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                />
              </div>
            </div>

            {/* Dimensions */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="flex flex-col gap-y-1.5">
                <Label size="small" weight="plus">
                  Height (cm)
                </Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-y-1.5">
                <Label size="small" weight="plus">
                  Width (cm)
                </Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-y-1.5">
                <Label size="small" weight="plus">
                  Length (cm)
                </Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-y-1.5">
                <Label size="small" weight="plus">
                  Weight (g)
                </Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </div>
            </div>

            <div className="bg-ui-bg-subtle border-ui-border-base mt-2 flex items-center justify-between rounded-lg border p-3">
              <div>
                <Text size="small" weight="plus">
                  Requires shipping
                </Text>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Does the inventory item require shipping?
                </Text>
              </div>
              <Switch
                checked={requiresShipping}
                onCheckedChange={setRequiresShipping}
              />
            </div>
          </div>
        </Container>

        {/* Availability */}
        <Container className="p-6">
          <Heading level="h2" className="mb-4">
            Availability
          </Heading>

          {isLoadingLocations ? (
            <Text size="small" className="text-ui-fg-subtle">
              Loading locations...
            </Text>
          ) : stockLocations.length === 0 ? (
            <Text size="small" className="text-ui-fg-subtle">
              No stock locations available.
            </Text>
          ) : (
            <div className="border-ui-border-base divide-ui-border-base divide-y rounded-lg border">
              {stockLocations.map((loc) => (
                <div
                  key={loc.id}
                  className="flex items-center justify-between p-3.5"
                >
                  <div className="flex flex-col">
                    <Text size="small" weight="plus">
                      {loc.name}
                    </Text>
                    {loc.address && (
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        {[loc.address.city, loc.address.country_code?.toUpperCase()]
                          .filter(Boolean)
                          .join(", ")}
                      </Text>
                    )}
                  </div>
                  <div className="flex items-center gap-x-3">
                    <Label size="small" className="text-ui-fg-subtle">
                      In Stock
                    </Label>
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
      </form>
    </div>
  )
}
