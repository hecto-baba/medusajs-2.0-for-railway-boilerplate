"use client"

import {
  deleteVendorInventoryItem,
  type VendorInventoryItem,
} from "@lib/data/vendor-client"
import { ActionMenu, SectionRow } from "@modules/common"
import { Container, Heading, toast, usePrompt } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { EditItemDrawer } from "../forms/edit-item-drawer"
import { PencilSquare, Trash } from "@medusajs/icons"

export const GeneralSection = ({ item }: { item: VendorInventoryItem }) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const [isEditOpen, setIsEditOpen] = useState(false)

  const { mutateAsync: remove } = useMutation({
    mutationFn: () => deleteVendorInventoryItem(item.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-inventory-items"] })
      toast.success("Inventory item deleted successfully.")
      router.push("/inventory")
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete item."
      )
    },
  })

  const handleDelete = async () => {
    const res = await prompt({
      title: "Are you sure?",
      description:
        "You are about to delete an inventory item. This action cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel",
    })

    if (res) {
      await remove()
    }
  }

  const actions = [
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
  ]

  const locationCount = item.location_levels?.length ?? 0

  const getQuantityFormat = (quantity: number | undefined | null) => {
    if (quantity !== undefined && quantity !== null && !isNaN(quantity)) {
      return `${quantity} across ${locationCount} locations`
    }
    return "-"
  }

  const stocked = item.location_levels?.length
    ? item.location_levels.reduce(
        (sum, lvl) => sum + Number(lvl.stocked_quantity ?? 0),
        0
      )
    : Number(item.stocked_quantity ?? 0)

  const reserved = item.location_levels?.length
    ? item.location_levels.reduce(
        (sum, lvl) => sum + Number(lvl.reserved_quantity ?? 0),
        0
      )
    : Number(item.reserved_quantity ?? 0)

  const available = stocked - reserved

  return (
    <>
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading>
            {item.title ?? item.sku} Details
          </Heading>
          <ActionMenu groups={actions} />
        </div>
        <SectionRow title="SKU" value={item.sku ?? "-"} />
        <SectionRow title="In Stock" value={getQuantityFormat(stocked)} />
        <SectionRow title="Reserved" value={getQuantityFormat(reserved)} />
        <SectionRow title="Available" value={getQuantityFormat(available)} />
      </Container>

      <EditItemDrawer
        item={item}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />
    </>
  )
}
