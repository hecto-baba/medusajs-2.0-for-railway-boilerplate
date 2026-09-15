"use client"

import {
  updateVendorItemLocationLevel,
  type VendorInventoryItem,
  type VendorInventoryLevel,
} from "@lib/data/vendor-client"
import { Button, Drawer, Heading, Input, Label, Text, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

type AdjustStockDrawerProps = {
  item: VendorInventoryItem
  level: VendorInventoryLevel | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

const AttributeGridRow = ({
  title,
  value,
}: {
  title: string
  value: string | number
}) => {
  return (
    <div className="grid grid-cols-2 divide-x">
      <Text className="px-2 py-1.5" size="small" leading="compact">
        {title}
      </Text>
      <Text className="px-2 py-1.5" size="small" leading="compact">
        {value}
      </Text>
    </div>
  )
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
      : level?.stock_locations?.name || level?.location_id || "Location"

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
      toast.success("Inventory level updated successfully.")
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
      toast.error(
        `Stocked quantity cannot be updated to less than the reserved quantity of ${reserved}.`
      )
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
            <Heading level="h2">Manage location quantity</Heading>
          </Drawer.Title>
        </Drawer.Header>

        <form
          onSubmit={onSubmit}
          className="flex flex-1 flex-col justify-between overflow-hidden"
        >
          <Drawer.Body className="flex flex-1 flex-col gap-y-8 overflow-auto p-6">
            <div className="text-ui-fg-subtle shadow-elevation-card-rest border-ui-border-base grid grid-rows-4 divide-y rounded-lg border">
              <AttributeGridRow
                title="Title"
                value={item.title ?? "-"}
              />
              <AttributeGridRow title="SKU" value={item.sku || "-"} />
              <AttributeGridRow
                title="Location"
                value={locationName}
              />
              <AttributeGridRow
                title="Reserved"
                value={reserved}
              />
              <AttributeGridRow
                title="Available"
                value={available}
              />
            </div>

            <div className="flex flex-col gap-y-1.5">
              <Label size="small" weight="plus">
                In Stock
              </Label>
              <Input
                type="number"
                min={0}
                value={stockedQuantity}
                onChange={(e) => {
                  const val = e.target.value
                  setStockedQuantity(val === "" ? 0 : parseFloat(val))
                }}
              />
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
            <Button type="submit" size="small" isLoading={isPending}>
              Save
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  )
}
