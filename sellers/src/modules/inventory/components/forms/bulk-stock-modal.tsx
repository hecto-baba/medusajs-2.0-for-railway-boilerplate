"use client"

import {
  batchVendorItemsLocationLevels,
  getVendorTaxonomy,
  type VendorInventoryItem,
} from "@lib/data/vendor-client"
import {
  Button,
  Drawer,
  Heading,
  Input,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

type BulkStockModalProps = {
  items: VendorInventoryItem[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export const BulkStockModal = ({
  items,
  open,
  onOpenChange,
  onSuccess,
}: BulkStockModalProps) => {
  const queryClient = useQueryClient()

  const { data: taxonomy } = useQuery({
    queryKey: ["vendor-taxonomy"],
    queryFn: getVendorTaxonomy,
    enabled: open,
  })

  const locations = taxonomy?.stock_locations ?? []

  // Grid state: { [itemId]: { [locationId]: quantity } }
  const [grid, setGrid] = useState<Record<string, Record<string, number>>>({})

  useEffect(() => {
    if (open && items.length) {
      const initial: Record<string, Record<string, number>> = {}
      for (const item of items) {
        initial[item.id] = {}
        for (const lvl of item.location_levels ?? []) {
          initial[item.id][lvl.location_id] = lvl.stocked_quantity ?? 0
        }
      }
      setGrid(initial)
    }
  }, [open, items])

  const handleQtyChange = (
    itemId: string,
    locationId: string,
    valStr: string
  ) => {
    const qty = parseInt(valStr)
    setGrid((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] ?? {}),
        [locationId]: isNaN(qty) ? 0 : Math.max(0, qty),
      },
    }))
  }

  const { mutateAsync: saveBatch, isPending } = useMutation({
    mutationFn: async () => {
      const updates: {
        id?: string
        inventory_item_id: string
        location_id: string
        stocked_quantity: number
      }[] = []

      const creates: {
        inventory_item_id: string
        location_id: string
        stocked_quantity: number
      }[] = []

      for (const item of items) {
        const itemGrid = grid[item.id] ?? {}
        const existingLevelMap = new Map(
          (item.location_levels ?? []).map((l) => [l.location_id, l])
        )

        for (const [locId, newQty] of Object.entries(itemGrid)) {
          const existingLevel = existingLevelMap.get(locId)
          if (existingLevel) {
            if (existingLevel.stocked_quantity !== newQty) {
              updates.push({
                id: existingLevel.id,
                inventory_item_id: item.id,
                location_id: locId,
                stocked_quantity: newQty,
              })
            }
          } else {
            creates.push({
              inventory_item_id: item.id,
              location_id: locId,
              stocked_quantity: newQty,
            })
          }
        }
      }

      if (updates.length === 0 && creates.length === 0) {
        return
      }

      return batchVendorItemsLocationLevels({
        create: creates.length > 0 ? creates : undefined,
        update: updates.length > 0 ? updates : undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-inventory-items"] })
      toast.success("Inventory levels updated successfully.")
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to update inventory levels."
      )
    },
  })

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await saveBatch()
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content className="flex max-w-4xl flex-col">
        <Drawer.Header>
          <Drawer.Title asChild>
            <Heading level="h2">Update inventory levels</Heading>
          </Drawer.Title>
          <Drawer.Description className="text-ui-fg-subtle txt-small">
            Update the stocked inventory levels for the selected inventory items.
          </Drawer.Description>
        </Drawer.Header>

        <form
          onSubmit={onSubmit}
          className="flex flex-1 flex-col justify-between overflow-hidden"
        >
          <Drawer.Body className="flex flex-1 flex-col gap-y-4 overflow-auto p-6">
            <div className="border-ui-border-base overflow-x-auto rounded-lg border">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell className="min-w-[200px]">
                      Item
                    </Table.HeaderCell>
                    {locations.map((loc) => (
                      <Table.HeaderCell
                        key={loc.id}
                        className="min-w-[140px] text-center"
                      >
                        {loc.name}
                      </Table.HeaderCell>
                    ))}
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {items.map((item) => {
                    const itemGrid = grid[item.id] ?? {}

                    return (
                      <Table.Row key={item.id}>
                        <Table.Cell>
                          <div className="flex flex-col">
                            <span className="text-ui-fg-base txt-compact-small font-medium truncate">
                              {item.title || "Untitled Item"}
                            </span>
                            {item.sku && (
                              <span className="text-ui-fg-subtle txt-compact-xsmall font-mono">
                                {item.sku}
                              </span>
                            )}
                          </div>
                        </Table.Cell>
                        {locations.map((loc) => {
                          const currentQty = itemGrid[loc.id] ?? 0
                          const existingLevel = item.location_levels?.find(
                            (l) => l.location_id === loc.id
                          )
                          const reserved = existingLevel?.reserved_quantity ?? 0

                          return (
                            <Table.Cell key={loc.id} className="p-2 text-center">
                              <div className="flex flex-col items-center gap-y-1">
                                <Input
                                  type="number"
                                  min={reserved}
                                  value={currentQty}
                                  onChange={(e) =>
                                    handleQtyChange(
                                      item.id,
                                      loc.id,
                                      e.target.value
                                    )
                                  }
                                  className="w-24 text-center"
                                />
                                {reserved > 0 && (
                                  <Text
                                    size="xsmall"
                                    className="text-ui-fg-muted"
                                  >
                                    ({reserved} reserved)
                                  </Text>
                                )}
                              </div>
                            </Table.Cell>
                          )
                        })}
                      </Table.Row>
                    )
                  })}
                </Table.Body>
              </Table>
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
