"use client"

import {
  createVendorProductType,
  updateVendorProductType,
  type VendorProductTypeItem,
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

type ProductTypeDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  productType?: VendorProductTypeItem | null
  onSuccess?: () => void
}

export const ProductTypeDrawer = ({
  open,
  onOpenChange,
  productType,
  onSuccess,
}: ProductTypeDrawerProps) => {
  const queryClient = useQueryClient()
  const isEditing = !!productType

  const [value, setValue] = useState("")

  useEffect(() => {
    if (productType) {
      setValue(productType.value || "")
    } else {
      setValue("")
    }
  }, [productType, open])

  const mutation = useMutation({
    mutationFn: async () => {
      if (isEditing) {
        return updateVendorProductType(productType!.id, {
          value: value.trim(),
        })
      } else {
        return createVendorProductType({
          value: value.trim(),
        })
      }
    },
    onSuccess: () => {
      toast.success(
        isEditing
          ? "Product type updated successfully"
          : "Product type created successfully"
      )
      queryClient.invalidateQueries({ queryKey: ["vendor-product-types"] })
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save product type")
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim()) {
      toast.error("Type value is required")
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
              {isEditing ? "Edit Product Type" : "Create Product Type"}
            </Heading>
          </Drawer.Title>
          <Drawer.Description className="text-ui-fg-subtle text-sm">
            {isEditing
              ? "Update product type label."
              : "Product types help categorize your products for search and filtering."}
          </Drawer.Description>
        </Drawer.Header>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col justify-between">
          <Drawer.Body className="flex flex-col gap-y-4 p-6">
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Type Value <span className="text-ui-fg-error">*</span>
              </Label>
              <Input
                placeholder="e.g. Shoes, Electronics, Merch"
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
              {isEditing ? "Save Changes" : "Create Type"}
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  )
}
