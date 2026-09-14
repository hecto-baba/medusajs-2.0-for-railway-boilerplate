"use client"

import {
  createVendorProductOption,
  listVendorProducts,
  updateVendorProductOption,
  type VendorProductOptionItem,
} from "@lib/data/vendor-client"
import {
  Badge,
  Button,
  Drawer,
  Heading,
  Input,
  Label,
  Select,
  Text,
  toast,
} from "@medusajs/ui"
import { Plus, XMark } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

type ProductOptionDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  option?: VendorProductOptionItem | null
  onSuccess?: () => void
}

export const ProductOptionDrawer = ({
  open,
  onOpenChange,
  option,
  onSuccess,
}: ProductOptionDrawerProps) => {
  const isEditing = Boolean(option)
  const queryClient = useQueryClient()

  const [title, setTitle] = useState("")
  const [productId, setProductId] = useState<string>("none")
  const [values, setValues] = useState<string[]>([])
  const [newValue, setNewValue] = useState("")

  // Fetch vendor's products to associate option with
  const { data: prodData } = useQuery({
    queryKey: ["vendor-products-for-options"],
    queryFn: () => listVendorProducts({ limit: 100, offset: 0 }),
    enabled: open,
  })

  const products = prodData?.products ?? []

  useEffect(() => {
    if (option) {
      setTitle(option.title || "")
      setProductId(option.product_id || "none")
      setValues((option.values || []).map((v) => v.value))
      setNewValue("")
    } else {
      setTitle("")
      setProductId("none")
      setValues([])
      setNewValue("")
    }
  }, [option, open])

  const addValue = () => {
    const trimmed = newValue.trim()
    if (!trimmed) return
    if (values.includes(trimmed)) {
      toast.error("Value already added")
      return
    }
    setValues([...values, trimmed])
    setNewValue("")
  }

  const removeValue = (valToRemove: string) => {
    setValues(values.filter((v) => v !== valToRemove))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      addValue()
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: {
      title: string
      values?: string[]
      product_id?: string
    }) => createVendorProductOption(data),
    onSuccess: () => {
      toast.success("Product option created successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-product-options"] })
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create product option")
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: {
      title?: string
      values?: string[]
    }) => updateVendorProductOption(option!.id, data),
    onSuccess: () => {
      toast.success("Product option updated successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-product-options"] })
      queryClient.invalidateQueries({
        queryKey: ["vendor-product-option", option?.id],
      })
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update product option")
    },
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      toast.error("Option title is required")
      return
    }

    if (values.length === 0 && newValue.trim()) {
      // Auto-add pending value if submitted
      values.push(newValue.trim())
    }

    if (values.length === 0) {
      toast.error("Please add at least one option value (e.g., Small, Medium, Large)")
      return
    }

    const payload = {
      title: title.trim(),
      values,
      ...(productId !== "none" ? { product_id: productId } : {}),
    }

    if (isEditing) {
      updateMutation.mutate({
        title: title.trim(),
        values,
      })
    } else {
      createMutation.mutate(payload)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content className="max-w-md">
        <Drawer.Header>
          <Drawer.Title asChild>
            <Heading level="h2">
              {isEditing ? "Edit Product Option" : "Create Product Option"}
            </Heading>
          </Drawer.Title>
          <Drawer.Description className="text-ui-fg-subtle text-sm">
            {isEditing
              ? "Update option title and allowable values."
              : "Define product options like Size, Color, or Material with their possible values."}
          </Drawer.Description>
        </Drawer.Header>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col justify-between">
          <Drawer.Body className="flex flex-col gap-y-5 p-6 overflow-y-auto">
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Option Title <span className="text-ui-fg-error">*</span>
              </Label>
              <Input
                placeholder="e.g. Size, Color, Material"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {!isEditing && (
              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Associate with Product (Optional)
                </Label>
                <Select
                  value={productId}
                  onValueChange={setProductId}
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Select a product..." />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="none">None (Global Option Template)</Select.Item>
                    {products.map((p) => (
                      <Select.Item key={p.id} value={p.id}>
                        {p.title}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Option Values <span className="text-ui-fg-error">*</span>
              </Label>
              <div className="flex items-center gap-x-2">
                <Input
                  placeholder="e.g. Small (press Enter to add)"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  onClick={addValue}
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>

              {values.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  {values.map((val) => (
                    <Badge
                      key={val}
                      color="grey"
                      size="base"
                      className="flex items-center gap-x-1 pl-2.5 pr-1 py-1"
                    >
                      <span>{val}</span>
                      <button
                        type="button"
                        onClick={() => removeValue(val)}
                        className="text-ui-fg-muted hover:text-ui-fg-error p-0.5 rounded"
                      >
                        <XMark className="h-3.5 w-3.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <Text size="xsmall" className="text-ui-fg-muted pt-1">
                  No values added yet. Type a value and click Add or press Enter.
                </Text>
              )}
            </div>
          </Drawer.Body>

          <Drawer.Footer className="flex items-center justify-end gap-x-2 border-t p-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isPending}>
              {isEditing ? "Save Changes" : "Create Option"}
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  )
}
