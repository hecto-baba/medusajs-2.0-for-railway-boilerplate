"use client"

import {
  batchVendorItemLocationLevels,
  getVendorTaxonomy,
  type VendorInventoryItem,
} from "@lib/data/vendor-client"
import {
  Button,
  Drawer,
  Heading,
  Input,
  Switch,
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
      toast.success("Locations updated successfully.")
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

    const toDelete = Array.from(existingLocationLevels).filter(
      (id) => !selectedLocationIds.has(id)
    )

    if (toCreate.length === 0 && toDelete.length === 0) {
      onOpenChange(false)
      return
    }

    await batchUpdate({
      create: toCreate.length > 0 ? toCreate : undefined,
      delete: toDelete.length > 0 ? toDelete : undefined,
    })
  }

  const allLocations = taxonomy?.stock_locations ?? []
  const filteredLocations = search.trim()
    ? allLocations.filter((loc) =>
        loc.name.toLowerCase().includes(search.toLowerCase())
      )
    : allLocations

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <Drawer.Content className="flex flex-col">
        <Drawer.Header>
          <Drawer.Title asChild>
            <Heading level="h2">Manage locations</Heading>
          </Drawer.Title>
        </Drawer.Header>

        <form
          onSubmit={onSubmit}
          className="flex flex-1 flex-col justify-between overflow-hidden"
        >
          <Drawer.Body className="flex flex-1 flex-col gap-y-4 overflow-auto p-6">
            <Input
              type="search"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {isLoadingTaxonomy ? (
              <Text size="small" className="text-ui-fg-subtle py-4 text-center">
                Loading locations...
              </Text>
            ) : filteredLocations.length === 0 ? (
              <Text size="small" className="text-ui-fg-subtle py-4 text-center">
                No locations found.
              </Text>
            ) : (
              <div className="border-ui-border-base divide-ui-border-base divide-y rounded-lg border">
                {filteredLocations.map((loc) => {
                  const isChecked = selectedLocationIds.has(loc.id)
                  const existing = item.location_levels?.find(
                    (l) => l.location_id === loc.id
                  )
                  const hasStockOrReserved =
                    existing &&
                    (Number(existing.stocked_quantity ?? 0) > 0 ||
                      Number(existing.reserved_quantity ?? 0) > 0)

                  return (
                    <div
                      key={loc.id}
                      className="hover:bg-ui-bg-subtle flex items-center justify-between p-3.5 transition-colors"
                    >
                      <div className="flex flex-col">
                        <Text size="small" weight="plus">
                          {loc.name}
                        </Text>
                        {(loc as any).address && (
                          <Text size="xsmall" className="text-ui-fg-subtle">
                            {[
                              (loc as any).address.city,
                              (loc as any).address.country_code?.toUpperCase(),
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          </Text>
                        )}
                      </div>
                      <Switch
                        checked={isChecked}
                        onCheckedChange={() => toggleLocation(loc.id)}
                        disabled={isChecked && !!hasStockOrReserved}
                      />
                    </div>
                  )
                })}
              </div>
            )}
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
