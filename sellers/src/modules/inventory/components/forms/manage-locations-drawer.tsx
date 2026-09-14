"use client"

import {
  batchVendorItemLocationLevels,
  getVendorTaxonomy,
  type VendorInventoryItem,
} from "@lib/data/vendor-client"
import {
  Button,
  Checkbox,
  Drawer,
  Heading,
  Input,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"

type ManageLocationsDrawerProps = {
  item: VendorInventoryItem
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export const ManageLocationsDrawer = ({
  item,
  open,
  onOpenChange,
  onSuccess,
}: ManageLocationsDrawerProps) => {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")

  const { data: taxonomy, isLoading: isLoadingTaxonomy } = useQuery({
    queryKey: ["vendor-taxonomy"],
    queryFn: getVendorTaxonomy,
    enabled: open,
  })

  const existingLocationLevels = useMemo(
    () => new Set(item.location_levels?.map((l) => l.location_id) ?? []),
    [item.location_levels]
  )

  const [selectedLocationIds, setSelectedLocationIds] = useState<Set<string>>(
    () => new Set(existingLocationLevels)
  )

  // Keep state updated if drawer re-opens with new item data
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setSelectedLocationIds(
        new Set(item.location_levels?.map((l) => l.location_id) ?? [])
      )
      setSearch("")
    }
    onOpenChange(nextOpen)
  }

  const toggleLocation = (locationId: string) => {
    setSelectedLocationIds((prev) => {
      const next = new Set(prev)
      if (next.has(locationId)) {
        next.delete(locationId)
      } else {
        next.add(locationId)
      }
      return next
    })
  }

  const { mutateAsync: batchUpdate, isPending } = useMutation({
    mutationFn: (body: {
      create?: { location_id: string; stocked_quantity?: number }[]
      delete?: string[]
    }) => batchVendorItemLocationLevels(item.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-inventory-items"] })
      queryClient.invalidateQueries({
        queryKey: ["vendor-inventory-item", item.id],
      })
      toast.success("Stock locations updated.")
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to update locations."
      )
    },
  })

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const toCreate = Array.from(selectedLocationIds)
      .filter((id) => !existingLocationLevels.has(id))
      .map((location_id) => ({ location_id, stocked_quantity: 0 }))

    const toDeleteLevels = (item.location_levels ?? [])
      .filter((lvl) => !selectedLocationIds.has(lvl.location_id))
      .map((lvl) => lvl.id)

    await batchUpdate({
      create: toCreate.length ? toCreate : undefined,
      delete: toDeleteLevels.length ? toDeleteLevels : undefined,
    })
  }

  const filteredLocations = useMemo(() => {
    const list = taxonomy?.stock_locations ?? []
    if (!search) return list
    return list.filter((loc) =>
      loc.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [taxonomy?.stock_locations, search])

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <Drawer.Content className="flex flex-col">
        <Drawer.Header>
          <Drawer.Title asChild>
            <Heading level="h2">Manage Stock Locations</Heading>
          </Drawer.Title>
          <Drawer.Description className="text-ui-fg-subtle txt-small">
            Select the warehouse and fulfillment locations where this item is stocked.
          </Drawer.Description>
        </Drawer.Header>

        <form
          onSubmit={onSubmit}
          className="flex flex-1 flex-col justify-between overflow-hidden"
        >
          <Drawer.Body className="flex flex-1 flex-col gap-y-4 overflow-auto p-6">
            <div className="bg-ui-bg-subtle border-ui-border-base flex items-center justify-between rounded-lg border px-3 py-2">
              <Text size="small" className="text-ui-fg-subtle">
                Selected Locations
              </Text>
              <Text size="small" weight="plus">
                {selectedLocationIds.size} of{" "}
                {taxonomy?.stock_locations?.length ?? 0}
              </Text>
            </div>

            <Input
              placeholder="Search locations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="border-ui-border-base divide-ui-border-base divide-y rounded-lg border">
              {isLoadingTaxonomy ? (
                <div className="p-4 text-center">
                  <Text size="small" className="text-ui-fg-subtle">
                    Loading locations...
                  </Text>
                </div>
              ) : filteredLocations.length === 0 ? (
                <div className="p-4 text-center">
                  <Text size="small" className="text-ui-fg-subtle">
                    No locations found.
                  </Text>
                </div>
              ) : (
                filteredLocations.map((loc) => {
                  const isChecked = selectedLocationIds.has(loc.id)
                  return (
                    <label
                      key={loc.id}
                      className="hover:bg-ui-bg-base-hover flex cursor-pointer items-center justify-between p-3 transition-colors"
                    >
                      <div className="flex items-center gap-x-3">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleLocation(loc.id)}
                        />
                        <div>
                          <Text size="small" weight="plus">
                            {loc.name}
                          </Text>
                          <Text size="xsmall" className="text-ui-fg-subtle">
                            ID: {loc.id}
                          </Text>
                        </div>
                      </div>
                      {isChecked && (
                        <span className="bg-ui-tag-neutral-bg text-ui-tag-neutral-text txt-compact-xsmall-plus rounded px-2 py-0.5">
                          Active
                        </span>
                      )}
                    </label>
                  )
                })
              )}
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
              Save Locations
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  )
}
