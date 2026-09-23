import { defineWidgetConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Text,
  Button,
  Input,
  Label,
  toast,
  Badge,
} from "@medusajs/ui"
import { ChefHat, Plus, Trash } from "@medusajs/icons"
import type { DetailWidgetProps, AdminProduct } from "@medusajs/framework/types"
import { useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"

type Addon = {
  name: string
  price: number
}

const DIETARY_OPTIONS = [
  { label: "None / Not Specified", value: "" },
  { label: "Vegetarian (Veg)", value: "veg" },
  { label: "Non-Vegetarian (Non-Veg)", value: "non_veg" },
  { label: "Contains Egg", value: "egg" },
  { label: "Vegan", value: "vegan" },
]

const ProductRestaurantConfigWidget = ({
  data: product,
}: DetailWidgetProps<AdminProduct>) => {
  const queryClient = useQueryClient()

  // Initialize from product metadata
  const initialDietary = (product.metadata?.dietary_type as string) || ""
  const initialAddons = Array.isArray(product.metadata?.addons)
    ? (product.metadata.addons as Addon[])
    : []

  const [dietaryType, setDietaryType] = useState<string>(initialDietary)
  const [addons, setAddons] = useState<Addon[]>(initialAddons)
  const [newAddonName, setNewAddonName] = useState("")
  const [newAddonPrice, setNewAddonPrice] = useState("1.50")
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    const metaDietary = (product.metadata?.dietary_type as string) || ""
    const metaAddons = Array.isArray(product.metadata?.addons)
      ? (product.metadata.addons as Addon[])
      : []
    setDietaryType(metaDietary)
    setAddons(metaAddons)
    setHasChanges(false)
  }, [product.metadata])

  const handleAddAddon = () => {
    if (!newAddonName.trim()) {
      toast.error("Error", { description: "Please enter a topping or extra item name" })
      return
    }
    const parsedPrice = parseFloat(newAddonPrice || "0")
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      toast.error("Error", { description: "Please enter a valid price" })
      return
    }

    const updated = [
      ...addons,
      {
        name: newAddonName.trim(),
        price: parsedPrice,
      },
    ]
    setAddons(updated)
    setNewAddonName("")
    setNewAddonPrice("1.50")
    setHasChanges(true)
  }

  const handleRemoveAddon = (index: number) => {
    const updated = addons.filter((_, i) => i !== index)
    setAddons(updated)
    setHasChanges(true)
  }

  const handleSelectDietary = (val: string) => {
    setDietaryType(val)
    setHasChanges(true)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const existingMeta = (product.metadata || {}) as Record<string, any>
      const newMeta = {
        ...existingMeta,
        dietary_type: dietaryType || null,
        addons: addons,
      }

      return sdk.client.fetch(`/admin/products/${product.id}`, {
        method: "POST",
        body: {
          metadata: newMeta,
        },
      })
    },
    onSuccess: () => {
      toast.success("Success", { description: "Dish dietary settings & toppings saved successfully" })
      setHasChanges(false)
      queryClient.invalidateQueries({ queryKey: ["products", product.id] })
    },
    onError: (err: any) => {
      toast.error("Save Failed", { description: err.message || "Failed to update dish details" })
    },
  })

  return (
    <Container className="divide-y p-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-x-2.5">
          <ChefHat className="text-ui-fg-muted h-5 w-5" />
          <div>
            <Heading level="h2" className="text-sm font-semibold text-ui-fg-base">
              Restaurant Dish Customizations
            </Heading>
            <Text className="text-xs text-ui-fg-subtle">
              Configure dietary category, extra add-ons, and topping prices for this food item
            </Text>
          </div>
        </div>
        {hasChanges && (
          <Badge color="blue" size="small">
            Unsaved Changes
          </Badge>
        )}
      </div>

      <div className="p-6 flex flex-col gap-y-6">
        {/* Section 1: Dietary Preference */}
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-ui-fg-muted block mb-2">
            Dietary Type
          </Label>
          <div className="flex flex-wrap gap-2">
            {DIETARY_OPTIONS.map((opt) => {
              const isSelected = dietaryType === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelectDietary(opt.value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition cursor-pointer ${
                    isSelected
                      ? "bg-ui-bg-base text-ui-fg-base border-ui-border-interactive shadow-xs font-semibold ring-1 ring-ui-border-interactive"
                      : "bg-ui-bg-subtle text-ui-fg-subtle border-ui-border-base hover:bg-ui-bg-base hover:text-ui-fg-base"
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Section 2: Toppings & Extras */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-ui-fg-muted">
              Optional Add-ons & Toppings ({addons.length})
            </Label>
          </div>
          <Text className="text-xs text-ui-fg-subtle mb-3">
            Customers can select these extras when ordering this item (e.g. Chocolate Crunches, Extra Cheese, Sprinkles).
          </Text>

          {/* Current Add-ons List */}
          {addons.length > 0 ? (
            <div className="flex flex-col gap-2 mb-4 border border-ui-border-base rounded-lg p-3 bg-ui-bg-subtle">
              {addons.map((addon, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-ui-bg-base border border-ui-border-base rounded-md px-3 py-2 text-sm shadow-2xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ui-fg-base">{addon.name}</span>
                    <span className="text-xs text-ui-fg-muted font-mono">
                      (+€{Number(addon.price).toFixed(2)})
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="transparent"
                    size="small"
                    onClick={() => handleRemoveAddon(idx)}
                    className="text-ui-fg-muted hover:text-ui-fg-error"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-ui-border-base rounded-lg p-4 text-center text-xs text-ui-fg-muted mb-4 bg-ui-bg-subtle/50">
              No extra toppings or add-ons added yet. Use the inputs below to add items.
            </div>
          )}

          {/* Add New Add-on Inputs */}
          <div className="flex flex-col sm:flex-row items-end gap-2 bg-ui-bg-subtle p-3 rounded-lg border border-ui-border-base">
            <div className="flex-1 w-full">
              <Label className="text-xs text-ui-fg-subtle mb-1 block">Topping / Extra Item Name</Label>
              <Input
                placeholder="e.g. Chocolate Crunches / Extra Cheese"
                value={newAddonName}
                onChange={(e) => setNewAddonName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleAddAddon()
                  }
                }}
              />
            </div>
            <div className="w-full sm:w-32">
              <Label className="text-xs text-ui-fg-subtle mb-1 block">Extra Price (€)</Label>
              <Input
                type="number"
                step="0.10"
                min="0"
                placeholder="1.50"
                value={newAddonPrice}
                onChange={(e) => setNewAddonPrice(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleAddAddon()
                  }
                }}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="base"
              onClick={handleAddAddon}
              className="w-full sm:w-auto"
            >
              <Plus className="mr-1 h-4 w-4" /> Add Item
            </Button>
          </div>
        </div>

        {/* Action Save Button */}
        <div className="flex justify-end pt-2 border-t border-ui-border-base">
          <Button
            type="button"
            variant="primary"
            size="small"
            disabled={!hasChanges || saveMutation.isPending}
            isLoading={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            Save Dish Customizations
          </Button>
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductRestaurantConfigWidget
