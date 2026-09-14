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
  Textarea,
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
  const [description, setDescription] = useState(item.description ?? "")

  useEffect(() => {
    if (open) {
      setTitle(item.title ?? "")
      setSku(item.sku ?? "")
      setDescription(item.description ?? "")
    }
  }, [item, open])

  const { mutateAsync: update, isPending } = useMutation({
    mutationFn: (values: {
      title: string
      sku: string | null
      description: string | null
    }) => updateVendorInventoryItem(item.id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-inventory-items"] })
      queryClient.invalidateQueries({
        queryKey: ["vendor-inventory-item", item.id],
      })
      toast.success("Inventory item updated.")
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
    if (!title.trim()) {
      toast.error("Title is required.")
      return
    }

    await update({
      title: title.trim(),
      sku: sku.trim() || null,
      description: description.trim() || null,
    })
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content className="flex flex-col">
        <Drawer.Header>
          <Drawer.Title asChild>
            <Heading level="h2">Edit General Information</Heading>
          </Drawer.Title>
          <Drawer.Description className="text-ui-fg-subtle txt-small">
            Update the title, SKU, and description of this inventory item.
          </Drawer.Description>
        </Drawer.Header>

        <form
          onSubmit={onSubmit}
          className="flex flex-1 flex-col justify-between overflow-hidden"
        >
          <Drawer.Body className="flex flex-1 flex-col gap-y-4 overflow-auto p-6">
            <div className="flex flex-col gap-y-1.5">
              <Label size="small" weight="plus">
                Title <span className="text-ui-fg-error">*</span>
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Cotton T-Shirt - Black / M"
              />
            </div>

            <div className="flex flex-col gap-y-1.5">
              <div className="flex items-center justify-between">
                <Label size="small" weight="plus">
                  SKU
                </Label>
                <span className="text-ui-fg-muted txt-compact-xsmall">Optional</span>
              </div>
              <Input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="e.g. TSHIRT-BLK-M"
              />
            </div>

            <div className="flex flex-col gap-y-1.5">
              <div className="flex items-center justify-between">
                <Label size="small" weight="plus">
                  Description
                </Label>
                <span className="text-ui-fg-muted txt-compact-xsmall">Optional</span>
              </div>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Item description..."
                rows={4}
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
