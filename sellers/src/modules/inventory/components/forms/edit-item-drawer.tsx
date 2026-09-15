"use client"

import {
  updateVendorInventoryItem,
  type VendorInventoryItem,
} from "@lib/data/vendor-client"
import {
  Button,
  Drawer,
  Heading,
  Input,
  Label,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

type EditItemDrawerProps = {
  item: VendorInventoryItem
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export const EditItemDrawer = ({
  item,
  open,
  onOpenChange,
  onSuccess,
}: EditItemDrawerProps) => {
  const queryClient = useQueryClient()

  const [title, setTitle] = useState(item.title ?? "")
  const [sku, setSku] = useState(item.sku ?? "")

  useEffect(() => {
    if (open) {
      setTitle(item.title ?? "")
      setSku(item.sku ?? "")
    }
  }, [item, open])

  const { mutateAsync: update, isPending } = useMutation({
    mutationFn: (values: {
      title?: string
      sku?: string
    }) => updateVendorInventoryItem(item.id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-inventory-items"] })
      queryClient.invalidateQueries({
        queryKey: ["vendor-inventory-item", item.id],
      })
      toast.success("Inventory item updated successfully.")
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to update item."
      )
    },
  })

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    await update({
      title: title.trim() || undefined,
      sku: sku.trim() || undefined,
    })
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content className="flex flex-col">
        <Drawer.Header>
          <Drawer.Title asChild>
            <Heading level="h2">Edit item details</Heading>
          </Drawer.Title>
        </Drawer.Header>

        <form
          onSubmit={onSubmit}
          className="flex flex-1 flex-col justify-between overflow-hidden"
        >
          <Drawer.Body className="flex flex-1 flex-col gap-y-8 overflow-auto p-6">
            <div className="flex flex-col gap-y-1.5">
              <Label size="small" weight="plus">
                Title
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-y-1.5">
              <Label size="small" weight="plus">
                SKU
              </Label>
              <Input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
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
              Save
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  )
}
