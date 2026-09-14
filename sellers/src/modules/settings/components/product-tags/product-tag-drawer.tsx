"use client"

import {
  createVendorProductTag,
  updateVendorProductTag,
  type VendorProductTagItem,
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

type ProductTagDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  productTag?: VendorProductTagItem | null
  onSuccess?: () => void
}

export const ProductTagDrawer = ({
  open,
  onOpenChange,
  productTag,
  onSuccess,
}: ProductTagDrawerProps) => {
  const queryClient = useQueryClient()
  const isEditing = !!productTag

  const [value, setValue] = useState("")

  useEffect(() => {
    if (productTag) {
      setValue(productTag.value || "")
    } else {
      setValue("")
    }
  }, [productTag, open])

  const mutation = useMutation({
    mutationFn: async () => {
      if (isEditing) {
        return updateVendorProductTag(productTag!.id, {
          value: value.trim(),
        })
      } else {
        return createVendorProductTag({
          value: value.trim(),
        })
      }
    },
    onSuccess: () => {
      toast.success(
        isEditing
          ? "Product tag updated successfully"
          : "Product tag created successfully"
      )
      queryClient.invalidateQueries({ queryKey: ["vendor-product-tags"] })
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save product tag")
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim()) {
      toast.error("Tag value is required")
      return
    }
    mutation.mutate()
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content className="max-w-md">
        <Drawer.Header>
          <Drawer.Title asChild>
            <Heading level="h2">
              {isEditing ? "Edit Product Tag" : "Create Product Tag"}
            </Heading>
          </Drawer.Title>
          <Drawer.Description className="text-ui-fg-subtle text-sm">
            {isEditing
              ? "Update tag label."
              : "Product tags help organize and filter products in your store."}
          </Drawer.Description>
        </Drawer.Header>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col justify-between">
          <Drawer.Body className="flex flex-col gap-y-4 p-6">
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Tag Value <span className="text-ui-fg-error">*</span>
              </Label>
              <Input
                placeholder="e.g. Summer, Sale, Organic, New"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
              />
            </div>
          </Drawer.Body>

          <Drawer.Footer className="flex items-center justify-end gap-x-2 border-t p-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={mutation.isPending}>
              {isEditing ? "Save Changes" : "Create Tag"}
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  )
}
