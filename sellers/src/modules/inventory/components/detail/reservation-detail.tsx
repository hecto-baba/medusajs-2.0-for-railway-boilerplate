"use client"

import {
  getVendorInventoryItem,
  getVendorReservation,
} from "@lib/data/vendor-client"
import { useBreadcrumbTitle } from "@modules/layout"
import { Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { ReservationGeneralSection } from "./reservation-general-section"
import { GeneralSection } from "./general-section"

export const ReservationDetail = ({ id }: { id: string }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["vendor-reservation", id],
    queryFn: () => getVendorReservation(id),
    retry: false,
  })

  const reservation = data?.reservation

  const { data: itemData } = useQuery({
    queryKey: ["vendor-inventory-item", reservation?.inventory_item_id],
    queryFn: () => getVendorInventoryItem(reservation!.inventory_item_id),
    enabled: !!reservation?.inventory_item_id,
  })

  const inventoryItem = itemData?.inventory_item

  useBreadcrumbTitle(
    reservation?.description ||
      (inventoryItem ? `Reservation of ${inventoryItem.title || inventoryItem.sku}` : "Reservation")
  )

  if (isLoading) {
    return <Text className="text-ui-fg-subtle p-6">Loading reservation...</Text>
  }

  if (error || !reservation) {
    return (
      <div className="p-6">
        <Text className="text-ui-fg-error">
          {error instanceof Error ? error.message : "Reservation not found."}
        </Text>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
      <div className="flex w-full flex-col gap-6 xl:max-w-4xl">
        <ReservationGeneralSection
          reservation={reservation}
          inventoryItem={inventoryItem}
        />
      </div>
      <div className="flex w-full flex-col gap-6 xl:max-w-sm">
        {inventoryItem && <GeneralSection item={inventoryItem} />}
      </div>
    </div>
  )
}
