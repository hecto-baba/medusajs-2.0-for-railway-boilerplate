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
  Label,
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

export const ReservationDrawer = ({
  item: initialItem,
  reservation,
  open,
  onOpenChange,
  onSuccess,
}: ReservationDrawerProps) => {
  const queryClient = useQueryClient()

  const isEdit = !!reservation

  // Fetch items for selection when creating globally
  const { data: inventoryData, isLoading: isLoadingItems } = useQuery({
    queryKey: ["vendor-inventory-items", 100, 0],
    queryFn: () => listVendorInventoryItems({ limit: 100, offset: 0 }),
    enabled: open && !initialItem && !isEdit,
  })

  const allItems = useMemo(
    () => inventoryData?.inventory_items ?? [],
    [inventoryData]
  )

  const [selectedItemId, setSelectedItemId] = useState<string>("")
  const [locationId, setLocationId] = useState<string>("")
  const [quantity, setQuantity] = useState<number | "">(1)
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

  const selectedLevel = useMemo(() => {
    if (!locationId || !activeLevels.length) return null
    return activeLevels.find((l) => l.location_id === locationId) ?? null
  }, [locationId, activeLevels])

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
          const firstLoc = initialItem.location_levels?.[0]?.location_id ?? ""
          setLocationId(firstLoc)
        } else if (allItems.length > 0) {
          setSelectedItemId(allItems[0].id)
          const firstLoc = allItems[0].location_levels?.[0]?.location_id ?? ""
          setLocationId(firstLoc)
        } else {
          setSelectedItemId("")
          setLocationId("")
        }
        setQuantity(1)
        setDescription("")
      }
    }
  }, [reservation, open, initialItem, allItems])

  const handleItemChange = (itemId: string) => {
    setSelectedItemId(itemId)
    const itm = allItems.find((i) => i.id === itemId)
    const firstLoc = itm?.location_levels?.[0]?.location_id ?? ""
    setLocationId(firstLoc)
  }

  const { mutateAsync: createRes, isPending: isCreating } = useMutation({
    mutationFn: (payload: {
      inventory_item_id: string
      location_id: string
      quantity: number
      description?: string
    }) => createVendorReservation(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-reservations"] })
      queryClient.invalidateQueries({ queryKey: ["vendor-inventory-items"] })
      if (activeItem) {
        queryClient.invalidateQueries({
          queryKey: ["vendor-inventory-item", activeItem.id],
        })
      }
      toast.success("Reservation was successfully created.")
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to create reservation."
      )
    },
  })

  const { mutateAsync: updateRes, isPending: isUpdating } = useMutation({
    mutationFn: (payload: {
      location_id?: string
      quantity?: number
      description?: string | null
    }) => updateVendorReservation(reservation!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-reservations"] })
      queryClient.invalidateQueries({
        queryKey: ["vendor-reservation", reservation!.id],
      })
      queryClient.invalidateQueries({ queryKey: ["vendor-inventory-items"] })
      if (activeItem) {
        queryClient.invalidateQueries({
          queryKey: ["vendor-inventory-item", activeItem.id],
        })
      }
      toast.success("Reservation was successfully updated.")
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to update reservation."
      )
    },
  })

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const qtyNum = typeof quantity === "number" ? quantity : parseInt(quantity)
    if (!selectedItemId) {
      toast.error("Please select an item to reserve.")
      return
    }
    if (!locationId) {
      toast.error("Please select a location.")
      return
    }
    if (isNaN(qtyNum) || qtyNum < 1) {
      toast.error("Quantity must be at least 1.")
      return
    }

    if (isEdit) {
      await updateRes({
        location_id: locationId,
        quantity: qtyNum,
        description: description.trim() || null,
      })
    } else {
      await createRes({
        inventory_item_id: selectedItemId,
        location_id: locationId,
        quantity: qtyNum,
        description: description.trim() || undefined,
      })
    }
  }

  const isPending = isCreating || isUpdating

  const availableQuantity = selectedLevel
    ? Number(selectedLevel.stocked_quantity ?? 0) -
      Number(selectedLevel.reserved_quantity ?? 0)
    : "-"

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content className="flex flex-col">
        <Drawer.Header>
          <Drawer.Title asChild>
            <Heading level="h2">
              {isEdit ? "Edit reservation" : "Create reservation"}
            </Heading>
          </Drawer.Title>
        </Drawer.Header>

        <form
          onSubmit={onSubmit}
          className="flex flex-1 flex-col justify-between overflow-hidden"
        >
          <Drawer.Body className="flex flex-1 flex-col gap-y-6 overflow-auto p-6">
            {!initialItem && !isEdit && (
              <div className="flex flex-col gap-y-1.5">
                <Label size="small" weight="plus">
                  Item to reserve
                </Label>
                {isLoadingItems ? (
                  <Text size="small" className="text-ui-fg-subtle">
                    Loading items...
                  </Text>
                ) : (
                  <Select
                    value={selectedItemId}
                    onValueChange={handleItemChange}
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Select an item" />
                    </Select.Trigger>
                    <Select.Content>
                      {allItems.map((itm) => (
                        <Select.Item key={itm.id} value={itm.id}>
                          {itm.title || itm.sku}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                )}
              </div>
            )}

            <div className="flex flex-col gap-y-1.5">
              <Label size="small" weight="plus">
                Location
              </Label>
              {activeLevels.length === 0 ? (
                <Text size="small" className="text-ui-fg-muted">
                  No warehouse locations assigned to this item.
                </Text>
              ) : (
                <Select
                  value={locationId}
                  onValueChange={setLocationId}
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Select location" />
                  </Select.Trigger>
                  <Select.Content>
                    {activeLevels.map((lvl) => {
                      const locName = Array.isArray(lvl.stock_locations)
                        ? lvl.stock_locations[0]?.name
                        : lvl.stock_locations?.name || lvl.location_id
                      return (
                        <Select.Item key={lvl.location_id} value={lvl.location_id}>
                          {locName}
                        </Select.Item>
                      )
                    })}
                  </Select.Content>
                </Select>
              )}
            </div>

            {/* Summary Card */}
            <div className="text-ui-fg-subtle shadow-elevation-card-rest border-ui-border-base grid grid-rows-4 divide-y rounded-lg border">
              <AttributeGridRow
                title="Title"
                value={activeItem?.title ?? activeItem?.sku ?? "-"}
              />
              <AttributeGridRow
                title="SKU"
                value={activeItem?.sku ?? "-"}
              />
              <AttributeGridRow
                title="In Stock"
                value={selectedLevel?.stocked_quantity ?? "-"}
              />
              <AttributeGridRow
                title="Available"
                value={availableQuantity}
              />
            </div>

            <div className="flex flex-col gap-y-1.5">
              <Label size="small" weight="plus">
                Reserve amount
              </Label>
              <Input
                type="number"
                min={1}
                placeholder="How much do you want to reserve?"
                value={quantity}
                onChange={(e) => {
                  const val = e.target.value
                  setQuantity(val === "" ? "" : parseInt(val))
                }}
                disabled={!selectedItemId || !locationId}
              />
            </div>

            <div className="flex flex-col gap-y-1.5">
              <div className="flex items-center justify-between">
                <Label size="small" weight="plus">
                  Description
                </Label>
                <span className="text-ui-fg-muted txt-compact-xsmall">
                  Optional
                </span>
              </div>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What type of reservation is this?"
                rows={3}
                disabled={!selectedItemId || !locationId}
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
              {isEdit ? "Save" : "Create"}
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  )
}
