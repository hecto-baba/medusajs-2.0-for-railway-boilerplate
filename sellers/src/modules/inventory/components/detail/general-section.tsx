"use client"

import {
  deleteVendorInventoryItem,
  type VendorInventoryItem,
} from "@lib/data/vendor-client"
import { ActionMenu, SectionRow } from "@modules/common"
import { Container, Heading, Text, toast, usePrompt } from "@medusajs/ui"
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

  const { mutateAsync: remove, isPending: isDeleting } = useMutation({
    mutationFn: () => deleteVendorInventoryItem(item.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-inventory-items"] })
      toast.success("Inventory item deleted.")
      router.push("/inventory")
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete item."
      )
    },
  })

  const handleDelete = async () => {
    const confirmed = await prompt({
      title: "Delete inventory item",
      description: `Are you sure you want to delete "${item.title || item.sku}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    })

    if (confirmed) {
      await remove()
    }
  }

  const actions = [
    {
      actions: [
        {
          icon: <PencilSquare />,
          label: "Edit general info",
          onClick: () => setIsEditOpen(true),
        },
        {
          icon: <Trash />,
          label: "Delete item",
          onClick: handleDelete,
        },
      ],
    },
  ]

  const totalStocked = item.location_levels?.length
    ? item.location_levels.reduce(
        (sum, lvl) => sum + Number(lvl.stocked_quantity ?? 0),
        0
      )
    : Number(item.stocked_quantity ?? 0)
  const totalReserved = item.location_levels?.length
    ? item.location_levels.reduce(
        (sum, lvl) => sum + Number(lvl.reserved_quantity ?? 0),
        0
      )
    : Number(item.reserved_quantity ?? 0)
  const available = totalStocked - totalReserved

  return (
    <>
      <Container className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-y-1">
            <div className="flex items-center gap-x-3">
              <Heading level="h1" className="text-xl font-semibold">
                {item.title || "Untitled Item"}
              </Heading>
              <span
                className={`txt-compact-xsmall-plus rounded px-2 py-0.5 ${
                  totalStocked === 0
                    ? "bg-ui-tag-red-bg text-ui-tag-red-text"
                    : available <= 5
                    ? "bg-ui-tag-orange-bg text-ui-tag-orange-text"
                    : "bg-ui-tag-green-bg text-ui-tag-green-text"
                }`}
              >
                {totalStocked === 0
                  ? "Out of stock"
                  : available <= 5
                  ? "Low stock"
                  : "In stock"}
              </span>
            </div>
            {item.sku && (
              <Text size="small" className="text-ui-fg-subtle font-mono">
                SKU: {item.sku}
              </Text>
            )}
          </div>
          <ActionMenu groups={actions} />
        </div>

        {item.description && (
          <Text size="small" className="text-ui-fg-subtle mt-4">
            {item.description}
          </Text>
        )}

        <div className="border-ui-border-base mt-6 border-t pt-4">
          <SectionRow
            title="Created"
            value={new Date(item.created_at).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          />
          <SectionRow
            title="Last updated"
            value={new Date(item.updated_at).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          />
        </div>
      </Container>

      <EditItemDrawer
        item={item}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />
    </>
  )
}
