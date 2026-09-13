"use client"

import {
  getVendorTaxonomy,
  listVendorInventoryLevels,
  setVendorInventoryLevel,
  setVendorVariantImages,
  type VendorProduct,
  type VendorVariant,
} from "@lib/data/vendor-client"
import { Button, Input, Label, Text, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

/**
 * Prices for every currency the store supports.
 *
 * The admin edits these in a spreadsheet grid; this is a field per currency,
 * which covers the same ground for the handful of currencies a store actually
 * has. Values are kept as strings so an empty input stays "no price in this
 * currency" rather than collapsing to 0.
 */
export const PriceFields = ({
  prices,
  onChange,
}: {
  prices: Record<string, string>
  onChange: (prices: Record<string, string>) => void
}) => {
  const { data: taxonomy } = useQuery({
    queryKey: ["vendor-taxonomy"],
    queryFn: getVendorTaxonomy,
    staleTime: 5 * 60 * 1000,
  })

  const currencies = taxonomy?.currencies ?? []

  if (!currencies.length) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-2">
      <Label size="small" weight="plus">
        Prices
      </Label>
      <div className="flex flex-col gap-y-2">
        {currencies.map((currency) => (
          <div key={currency.code} className="flex items-center gap-x-2">
            <span className="text-ui-fg-subtle txt-compact-small w-12 uppercase">
              {currency.code}
            </span>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="No price"
              value={prices[currency.code] ?? ""}
              onChange={(event) =>
                onChange({ ...prices, [currency.code]: event.target.value })
              }
            />
          </div>
        ))}
      </div>
      <Text size="xsmall" className="text-ui-fg-muted">
        Leave a currency blank to not sell in it.
      </Text>
    </div>
  )
}

/**
 * Stock per location for one variant.
 *
 * Only rendered for variants that manage inventory - the rest have no
 * inventory item behind them, and the API rightly refuses to set stock on one.
 */
export const InventoryFields = ({
  product,
  variant,
}: {
  product: VendorProduct
  variant: VendorVariant
}) => {
  const queryClient = useQueryClient()
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const { data: taxonomy } = useQuery({
    queryKey: ["vendor-taxonomy"],
    queryFn: getVendorTaxonomy,
    staleTime: 5 * 60 * 1000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-inventory", product.id, variant.id],
    queryFn: () => listVendorInventoryLevels(product.id, variant.id),
    enabled: Boolean(variant.manage_inventory),
    retry: false,
  })

  const levels = data?.inventory_levels ?? []
  const locations = taxonomy?.stock_locations ?? []

  // Seeded from the server once loaded, then owned by the inputs - so typing
  // is not overwritten every time the query refetches.
  useEffect(() => {
    if (!levels.length) {
      return
    }

    setDrafts((previous) => {
      const next = { ...previous }

      levels.forEach((level) => {
        if (next[level.location_id] === undefined) {
          next[level.location_id] = String(level.stocked_quantity)
        }
      })

      return next
    })
  }, [levels])

  const { mutateAsync: save, isPending } = useMutation({
    mutationFn: (input: { location_id: string; stocked_quantity: number }) =>
      setVendorInventoryLevel(product.id, variant.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["vendor-inventory", product.id, variant.id],
      })
    },
  })

  if (!variant.manage_inventory) {
    return (
      <Text size="xsmall" className="text-ui-fg-muted">
        Turn on "Manage inventory" to track stock for this variant.
      </Text>
    )
  }

  if (isLoading) {
    return (
      <Text size="xsmall" className="text-ui-fg-muted">
        Loading stock…
      </Text>
    )
  }

  const onSave = async (locationId: string) => {
    const raw = drafts[locationId] ?? ""
    const quantity = Number(raw)

    if (!raw.trim() || !Number.isInteger(quantity) || quantity < 0) {
      toast.error("Enter a whole number of zero or more.")
      return
    }

    try {
      await save({ location_id: locationId, stocked_quantity: quantity })
      toast.success("Stock updated.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update the stock."
      )
    }
  }

  return (
    <div className="flex flex-col gap-y-2">
      <Label size="small" weight="plus">
        Stock
      </Label>
      {locations.length ? (
        locations.map((location) => {
          const level = levels.find(
            (entry) => entry.location_id === location.id
          )

          return (
            <div key={location.id} className="flex flex-col gap-y-1">
              <div className="flex items-center gap-x-2">
                <span className="text-ui-fg-subtle txt-compact-small flex-1 truncate">
                  {location.name}
                </span>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  className="w-28"
                  value={drafts[location.id] ?? ""}
                  onChange={(event) =>
                    setDrafts({ ...drafts, [location.id]: event.target.value })
                  }
                />
                <Button
                  size="small"
                  variant="secondary"
                  isLoading={isPending}
                  onClick={() => onSave(location.id)}
                >
                  Set
                </Button>
              </div>
              {level ? (
                <Text size="xsmall" className="text-ui-fg-muted">
                  {level.reserved_quantity} reserved · {level.available_quantity}{" "}
                  available
                </Text>
              ) : (
                <Text size="xsmall" className="text-ui-fg-muted">
                  Not stocked here yet.
                </Text>
              )}
            </div>
          )
        })
      ) : (
        <Text size="xsmall" className="text-ui-fg-muted">
          The store has no stock locations.
        </Text>
      )}
    </div>
  )
}

/**
 * Which of the product's images belong to this variant.
 *
 * Images live on the product; a variant points at a subset of them. So this
 * toggles association rather than uploading - uploading happens once, in the
 * product's Media section.
 */
export const VariantImageFields = ({
  product,
  variant,
}: {
  product: VendorProduct
  variant: VendorVariant
}) => {
  const queryClient = useQueryClient()
  const images = product.images ?? []
  const [selected, setSelected] = useState<string[]>([])
  const [seeded, setSeeded] = useState(false)

  // The variant's current images are not returned on the product, so the
  // selection starts empty and is applied as a replacement on save.
  useEffect(() => {
    if (!seeded) {
      setSelected([])
      setSeeded(true)
    }
  }, [seeded])

  const { mutateAsync: save, isPending } = useMutation({
    mutationFn: (add: string[]) =>
      setVendorVariantImages(product.id, variant.id, { add }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-product", product.id] })
    },
  })

  if (!images.length) {
    return (
      <Text size="xsmall" className="text-ui-fg-muted">
        Add images to the product first, then assign them here.
      </Text>
    )
  }

  const onSave = async () => {
    try {
      await save(selected)
      toast.success("Variant images updated.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update the images."
      )
    }
  }

  return (
    <div className="flex flex-col gap-y-2">
      <Label size="small" weight="plus">
        Images
      </Label>
      <div className="flex flex-wrap gap-2">
        {images.map((image) => {
          const active = selected.includes(image.id)

          return (
            <button
              key={image.id}
              type="button"
              onClick={() =>
                setSelected(
                  active
                    ? selected.filter((id) => id !== image.id)
                    : [...selected, image.id]
                )
              }
              className={
                "h-16 w-16 overflow-hidden rounded-md border-2 " +
                (active ? "border-ui-border-interactive" : "border-transparent")
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt=""
                className="h-full w-full object-cover"
              />
            </button>
          )
        })}
      </div>
      <Button
        size="small"
        variant="secondary"
        onClick={onSave}
        isLoading={isPending}
        disabled={!selected.length}
      >
        Assign {selected.length || ""} to variant
      </Button>
    </div>
  )
}
