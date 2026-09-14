"use client"

import {
  updateVendorItemLocationLevel,
  type VendorInventoryItem,
  type VendorInventoryLevel,
} from "@lib/data/vendor-client"
import { Button, Drawer, Heading, Input, Text, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

type AdjustStockDrawerProps = {
  item: VendorInventoryItem
  level: VendorInventoryLevel | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export const AdjustStockDrawer = ({
  item,
  level,
  open,
  onOpenChange,
  onSuccess,
}: AdjustStockDrawerProps) => {
  const queryClient = useQueryClient()
  const [stockedQuantity, setStockedQuantity] = useState<number>(0)

  useEffect(() => {
    if (level) {
      setStockedQuantity(level.stocked_quantity ?? 0)
    }
  }, [level, open])

  const reserved = level?.reserved_quantity ?? 0
  const available = Math.max(0, stockedQuantity - reserved)
  const isInvalid = stockedQuantity < reserved

  const locationName =
    Array.isArray(level?.stock_locations)
      ? level?.stock_locations[0]?.name
      : level?.stock_locations?.name || "Warehouse Location"

  const { mutateAsync: updateLevel, isPending } = useMutation({
    mutationFn: async () => {
      if (!level) return
      return updateVendorItemLocationLevel(item.id, level.location_id, {
        stocked_quantity: Number(stockedQuantity),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-inventory-items"] })
      queryClient.invalidateQueries({
        queryKey: ["vendor-inventory-item", item.id],
      })
      toast.success("Stock level updated.")
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to update stock."
      )
    },
  })

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isInvalid) {
      toast.error(`Stock cannot be less than reserved quantity (${reserved}).`)
      return
    }
    await updateLevel()
  }

  if (!level) return null

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content className="flex flex-col">
        <Drawer.Header>
          <Drawer.Title asChild>
            <Heading level="h2">Adjust Stock</Heading>
          </Drawer.Title>
          <Drawer.Description className="text-ui-fg-subtle txt-small">
            Set the in-stock quantity for {item.title || item.sku} at{" "}
            <span className="text-ui-fg-base font-medium">{locationName}</span>.
          </Drawer.Description>
        </Drawer.Header>

        <form
          onSubmit={onSubmit}
          className="flex flex-1 flex-col justify-between overflow-hidden"
        >
          <Drawer.Body className="flex flex-1 flex-col gap-y-6 overflow-auto p-6">
            <div className="bg-ui-bg-subtle border-ui-border-base divide-ui-border-base grid grid-cols-3 divide-x rounded-lg border text-center">
              <div className="p-3">
                <Text size="xsmall" className="text-ui-fg-subtle uppercase">
                  In Stock
                </Text>
                <Text size="large" weight="plus" className="text-ui-fg-base">
                  {stockedQuantity}
                </Text>
              </div>
              <div className="p-3">
                <Text size="xsmall" className="text-ui-fg-subtle uppercase">
                  Reserved
                </Text>
                <Text size="large" weight="plus" className="text-ui-fg-muted">
                  {reserved}
                </Text>
              </div>
              <div className="p-3">
                <Text size="xsmall" className="text-ui-fg-subtle uppercase">
                  Available
                </Text>
                <Text
                  size="large"
                  weight="plus"
                  className={
                    available > 0 ? "text-ui-fg-interactive" : "text-ui-fg-error"
                  }
                >
                  {available}
                </Text>
              </div>
            </div>

            <div className="flex flex-col gap-y-2">
              <label className="text-ui-fg-base txt-compact-small-plus">
                In Stock Quantity
              </label>
              <Input
                type="number"
                min={reserved}
                value={stockedQuantity}
                onChange={(e) => setStockedQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full"
              />
              <Text size="xsmall" className="text-ui-fg-subtle">
                Enter the total physical count available at this warehouse.
              </Text>
              {isInvalid && (
                <Text size="xsmall" className="text-ui-fg-error">
                  Must be at least {reserved} units to cover existing reservations.
                </Text>
              )}
            </div>

            <div className="border-ui-border-base bg-ui-bg-subtle flex flex-col gap-y-2 rounded-lg border p-3">
              <div className="flex justify-between">
                <Text size="small" className="text-ui-fg-subtle">
                  Item SKU
                </Text>
                <Text size="small" weight="plus">
                  {item.sku || "-"}
                </Text>
              </div>
              <div className="flex justify-between">
                <Text size="small" className="text-ui-fg-subtle">
                  Location
                </Text>
                <Text size="small" weight="plus">
                  {locationName}
                </Text>
              </div>
            </div>
          </Drawer.Body>

          <Drawer.Footer className="border-ui-border-base flex items-center justify-end gap-x-2 border-t p-4">
            <Button
              type="button"
              variant="secondary"
              size="small"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="small"
              isLoading={isPending}
              disabled={isInvalid}
            >
              Save Stock
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  )
}
