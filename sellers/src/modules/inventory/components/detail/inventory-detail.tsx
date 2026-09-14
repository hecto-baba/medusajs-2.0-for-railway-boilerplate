"use client"

import { getVendorInventoryItem } from "@lib/data/vendor-client"
import { useBreadcrumbTitle } from "@modules/layout"
import { Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { GeneralSection } from "./general-section"
import { LocationLevelsSection } from "./location-levels-section"
import { ReservationsSection } from "./reservations-section"
import { VariantsSection } from "./variants-section"
import { AttributesSection } from "./attributes-section"

export const InventoryDetail = ({ id }: { id: string }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["vendor-inventory-item", id],
    queryFn: () => getVendorInventoryItem(id),
    retry: false,
  })

  useBreadcrumbTitle(
    data?.inventory_item?.title || data?.inventory_item?.sku || "Inventory Item"
  )

  if (isLoading) {
    return <Text className="text-ui-fg-subtle p-6">Loading inventory item...</Text>
  }

  if (error || !data?.inventory_item) {
    return (
      <div className="p-6">
        <Text className="text-ui-fg-error">
          {error instanceof Error ? error.message : "Inventory item not found."}
        </Text>
      </div>
    )
  }

  const item = data.inventory_item

  return (
    <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
      <div className="flex w-full flex-col gap-6 xl:max-w-4xl">
        <GeneralSection item={item} />
        <LocationLevelsSection item={item} />
        <ReservationsSection item={item} />
      </div>
      <div className="flex w-full flex-col gap-6 xl:max-w-sm">
        <VariantsSection item={item} />
        <AttributesSection item={item} />
      </div>
    </div>
  )
}
