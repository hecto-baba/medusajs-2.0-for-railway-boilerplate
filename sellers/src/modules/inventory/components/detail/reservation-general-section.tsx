"use client"

import {
  deleteVendorReservation,
  getVendorTaxonomy,
  type VendorInventoryItem,
  type VendorReservation,
} from "@lib/data/vendor-client"
import { ActionMenu, SectionRow } from "@modules/common"
import { Container, Heading, toast, usePrompt } from "@medusajs/ui"
import { PencilSquare, Trash } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { ReservationDrawer } from "../forms/reservation-drawer"

type ReservationGeneralSectionProps = {
  reservation: VendorReservation
  inventoryItem?: VendorInventoryItem | null
}

export const ReservationGeneralSection = ({
  reservation,
  inventoryItem,
}: ReservationGeneralSectionProps) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const [isEditOpen, setIsEditOpen] = useState(false)

  const { data: taxonomy } = useQuery({
    queryKey: ["vendor-taxonomy"],
    queryFn: getVendorTaxonomy,
  })

  const locations = taxonomy?.stock_locations ?? []
  const location = locations.find((l) => l.id === reservation.location_id)

  const locationLevel = inventoryItem?.location_levels?.find(
    (l) => l.location_id === reservation.location_id
  )

  const { mutateAsync: remove } = useMutation({
    mutationFn: () => deleteVendorReservation(reservation.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-reservations"] })
      queryClient.invalidateQueries({ queryKey: ["vendor-inventory-items"] })
      toast.success("Reservation was successfully deleted.")
      router.push("/reservations")
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete reservation."
      )
    },
  })

  const handleDelete = async () => {
    const res = await prompt({
      title: "Are you sure?",
      description:
        "You are about to delete a reservation. This action cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel",
    })

    if (res) {
      await remove()
    }
  }

  const actions = useMemo(
    () => [
      {
        actions: [
          {
            icon: <PencilSquare />,
            label: "Edit",
            onClick: () => setIsEditOpen(true),
          },
          {
            icon: <Trash />,
            label: "Delete",
            onClick: handleDelete,
          },
        ],
      },
    ],
    [handleDelete]
  )

  const itemName =
    inventoryItem?.title ?? inventoryItem?.sku ?? reservation.inventory_item_id

  return (
    <>
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading>Reservation of {itemName}</Heading>
          <ActionMenu groups={actions} />
        </div>
        <SectionRow
          title="Line item ID"
          value={reservation.line_item_id ?? "-"}
        />
        <SectionRow
          title="Description"
          value={reservation.description ?? "-"}
        />
        <SectionRow
          title="Location"
          value={location?.name ?? reservation.location_id}
        />
        <SectionRow
          title="In stock at this location"
          value={locationLevel?.stocked_quantity ?? "-"}
        />
        <SectionRow
          title="Available at this location"
          value={
            locationLevel
              ? Number(locationLevel.stocked_quantity ?? 0) -
                Number(locationLevel.reserved_quantity ?? 0)
              : "-"
          }
        />
        <SectionRow
          title="Reserved at this location"
          value={locationLevel?.reserved_quantity ?? "-"}
        />
      </Container>

      {/* Edit Drawer */}
      <ReservationDrawer
        item={inventoryItem}
        reservation={reservation}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />
    </>
  )
}
