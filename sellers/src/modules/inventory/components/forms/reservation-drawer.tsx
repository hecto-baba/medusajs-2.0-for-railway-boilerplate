"use client"

import {
  createVendorReservation,
  listVendorInventoryItems,
  updateVendorReservation,
  type VendorInventoryItem,
  type VendorReservation,
} from "@lib/data/vendor-client"
import {
  Button,
  Drawer,
  Heading,
  Input,
  Select,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"

type ReservationDrawerProps = {
  item?: VendorInventoryItem | null
  reservation?: VendorReservation | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export const ReservationDrawer = ({
  item: initialItem,
  reservation,
  open,
  onOpenChange,
  onSuccess,
}: ReservationDrawerProps) => {
  const queryClient = useQueryClient()

  const isEdit = !!reservation

  // For global creation mode without pre-passed item
  const { data: inventoryData, isLoading: isLoadingItems } = useQuery({
    queryKey: ["vendor-inventory-items", 100, 0],
    queryFn: () => listVendorInventoryItems({ limit: 100, offset: 0 }),
    enabled: open && !initialItem,
  })

  const allItems = useMemo(
    () => inventoryData?.inventory_items ?? [],
    [inventoryData]
  )

  const [selectedItemId, setSelectedItemId] = useState<string>("")
  const [locationId, setLocationId] = useState<string>("")
  const [quantity, setQuantity] = useState<number>(1)
  const [description, setDescription] = useState<string>("")

  const activeItem = useMemo(() => {
    if (initialItem) return initialItem
    if (selectedItemId) {
      return allItems.find((i) => i.id === selectedItemId) ?? null
    }
    return null
  }, [initialItem, selectedItemId, allItems])

  const activeLevels = useMemo(
    () => activeItem?.location_levels ?? [],
    [activeItem]
  )

  useEffect(() => {
    if (open) {
      if (reservation) {
        setSelectedItemId(reservation.inventory_item_id)
        setLocationId(reservation.location_id)
        setQuantity(reservation.quantity)
        setDescription(reservation.description ?? "")
      } else {
        if (initialItem) {
          setSelectedItemId(initialItem.id)
          setLocationId(initialItem.location_levels?.[0]?.location_id ?? "")
        } else if (allItems.length > 0) {
          setSelectedItemId(allItems[0].id)
          setLocationId(allItems[0].location_levels?.[0]?.location_id ?? "")
        } else {
          setSelectedItemId("")
          setLocationId("")
        }
        setQuantity(1)
        setDescription("")
      }
    }
  }, [reservation, open, initialItem, allItems])

  // When selected item changes in create mode, pick its first location
  const handleItemChange = (itemId: string) => {
    setSelectedItemId(itemId)
    const itm = allItems.find((i) => i.id === itemId)
    setLocationId(itm?.location_levels?.[0]?.location_id ?? "")
  }

  const { mutateAsync: saveReservation, isPending } = useMutation({
    mutationFn: async () => {
      const targetItemId = activeItem?.id || reservation?.inventory_item_id
      if (!targetItemId) {
        throw new Error("Please select an inventory item.")
      }

      if (isEdit && reservation) {
        return updateVendorReservation(reservation.id, {
          location_id: locationId,
          quantity: Number(quantity),
          description: description || null,
        })
      } else {
        return createVendorReservation({
          inventory_item_id: targetItemId,
          location_id: locationId,
          quantity: Number(quantity),
          description: description || null,
        })
      }
    },
    onSuccess: () => {
      const targetItemId = activeItem?.id || reservation?.inventory_item_id
      queryClient.invalidateQueries({ queryKey: ["vendor-inventory-items"] })
      if (targetItemId) {
        queryClient.invalidateQueries({
          queryKey: ["vendor-inventory-item", targetItemId],
        })
      }
      queryClient.invalidateQueries({ queryKey: ["vendor-reservations"] })
      toast.success(
        isEdit ? "Reservation updated." : "Reservation created successfully."
      )
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to save reservation."
      )
    },
  })

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeItem && !isEdit) {
      toast.error("Please select an inventory item.")
      return
    }
    if (!locationId) {
      toast.error("Please select a stock location.")
      return
    }
    if (quantity < 1) {
      toast.error("Quantity must be at least 1.")
      return
    }
    await saveReservation()
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content className="flex flex-col">
        <Drawer.Header>
          <Drawer.Title asChild>
            <Heading level="h2">
              {isEdit ? "Edit Reservation" : "Create Reservation"}
            </Heading>
          </Drawer.Title>
          <Drawer.Description className="text-ui-fg-subtle txt-small">
            Reserve inventory units for holds, manual allocations, or drafts.
          </Drawer.Description>
        </Drawer.Header>

        <form
          onSubmit={onSubmit}
          className="flex flex-1 flex-col justify-between overflow-hidden"
        >
          <Drawer.Body className="flex flex-1 flex-col gap-y-4 overflow-auto p-6">
            {!initialItem && !isEdit && (
              <div className="flex flex-col gap-y-1.5">
                <label className="text-ui-fg-base txt-compact-small-plus">
                  Inventory Item
                </label>
                {isLoadingItems ? (
                  <Text size="small" className="text-ui-fg-muted">
                    Loading inventory items…
                  </Text>
                ) : allItems.length > 0 ? (
                  <Select
                    value={selectedItemId}
                    onValueChange={handleItemChange}
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Select an inventory item" />
                    </Select.Trigger>
                    <Select.Content>
                      {allItems.map((itm) => (
                        <Select.Item key={itm.id} value={itm.id}>
                          {itm.title || itm.sku || "Untitled Item"}
                          {itm.sku ? ` (${itm.sku})` : ""}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                ) : (
                  <Text size="small" className="text-ui-fg-error">
                    No inventory items found. Please create an inventory item first.
                  </Text>
                )}
              </div>
            )}

            <div className="flex flex-col gap-y-1.5">
              <label className="text-ui-fg-base txt-compact-small-plus">
                Stock Location
              </label>
              {activeLevels.length > 0 ? (
                <Select
                  value={locationId}
                  onValueChange={setLocationId}
                  disabled={isEdit}
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Select location" />
                  </Select.Trigger>
                  <Select.Content>
                    {activeLevels.map((lvl) => {
                      const name = Array.isArray(lvl.stock_locations)
                        ? lvl.stock_locations[0]?.name
                        : lvl.stock_locations?.name || lvl.location_id
                      return (
                        <Select.Item key={lvl.location_id} value={lvl.location_id}>
                          {name} ({lvl.available_quantity ?? (Number(lvl.stocked_quantity ?? 0) - Number(lvl.reserved_quantity ?? 0))} available)
                        </Select.Item>
                      )
                    })}
                  </Select.Content>
                </Select>
              ) : activeItem ? (
                <Text size="small" className="text-ui-fg-error">
                  This item is not stocked at any location yet. Please manage locations first.
                </Text>
              ) : (
                <Text size="small" className="text-ui-fg-subtle">
                  Select an inventory item first.
                </Text>
              )}
            </div>

            <div className="flex flex-col gap-y-1.5">
              <label className="text-ui-fg-base txt-compact-small-plus">
                Reserved Quantity
              </label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              />
              <Text size="xsmall" className="text-ui-fg-subtle">
                Number of units to lock from available stock.
              </Text>
            </div>

            <div className="flex flex-col gap-y-1.5">
              <label className="text-ui-fg-base txt-compact-small-plus">
                Description (Optional)
              </label>
              <Textarea
                placeholder="Reason or reference for reservation..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
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
            <Button
              type="submit"
              size="small"
              isLoading={isPending}
              disabled={activeLevels.length === 0 && !isEdit}
            >
              {isEdit ? "Update Reservation" : "Create Reservation"}
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  )
}
