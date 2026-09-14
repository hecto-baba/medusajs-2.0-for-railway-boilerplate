"use client"

import {
  createVendorCategory,
  listVendorCategories,
  updateVendorCategory,
  type VendorCategory,
} from "@lib/data/vendor-client"
import {
  Button,
  Drawer,
  Heading,
  Input,
  Label,
  Select,
  Switch,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

type CategoryDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  category?: VendorCategory | null
  onSuccess?: () => void
}

export const CategoryDrawer = ({
  open,
  onOpenChange,
  category,
  onSuccess,
}: CategoryDrawerProps) => {
  const isEditing = Boolean(category)
  const queryClient = useQueryClient()

  const [name, setName] = useState("")
  const [handle, setHandle] = useState("")
  const [description, setDescription] = useState("")
  const [parentCategoryId, setParentCategoryId] = useState<string>("none")
  const [isActive, setIsActive] = useState(true)
  const [isInternal, setIsInternal] = useState(false)

  // Fetch existing categories to choose as parent
  const { data: catData } = useQuery({
    queryKey: ["vendor-categories-for-parent"],
    queryFn: () => listVendorCategories({ limit: 100, offset: 0 }),
    enabled: open,
  })

  const availableParents = (catData?.categories ?? []).filter(
    (c) => !category || c.id !== category.id
  )

  useEffect(() => {
    if (category) {
      setName(category.name || "")
      setHandle(category.handle || "")
      setDescription(category.description || "")
      setParentCategoryId(category.parent_category_id || "none")
      setIsActive(category.is_active ?? true)
      setIsInternal(category.is_internal ?? false)
    } else {
      setName("")
      setHandle("")
      setDescription("")
      setParentCategoryId("none")
      setIsActive(true)
      setIsInternal(false)
    }
  }, [category, open])

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string
      handle?: string
      description?: string
      parent_category_id?: string | null
      is_active?: boolean
      is_internal?: boolean
    }) => createVendorCategory(data),
    onSuccess: () => {
      toast.success("Category created successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-categories"] })
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create category")
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: {
      name?: string
      handle?: string
      description?: string
      parent_category_id?: string | null
      is_active?: boolean
      is_internal?: boolean
    }) => updateVendorCategory(category!.id, data),
    onSuccess: () => {
      toast.success("Category updated successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-categories"] })
      queryClient.invalidateQueries({
        queryKey: ["vendor-category", category?.id],
      })
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update category")
    },
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error("Name is required")
      return
    }

    const payload = {
      name: name.trim(),
      ...(handle.trim() ? { handle: handle.trim().toLowerCase() } : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
      parent_category_id: parentCategoryId === "none" ? null : parentCategoryId,
      is_active: isActive,
      is_internal: isInternal,
    }

    if (isEditing) {
      updateMutation.mutate(payload)
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
              {isEditing ? "Edit Category" : "Create Category"}
            </Heading>
          </Drawer.Title>
          <Drawer.Description className="text-ui-fg-subtle text-sm">
            {isEditing
              ? "Update product category details and taxonomy."
              : "Organize products into hierarchical categories."}
          </Drawer.Description>
        </Drawer.Header>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col justify-between">
          <Drawer.Body className="flex flex-col gap-y-4 p-6 overflow-y-auto">
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Name <span className="text-ui-fg-error">*</span>
              </Label>
              <Input
                placeholder="Apparel"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Handle
              </Label>
              <Input
                placeholder="apparel"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Parent Category
              </Label>
              <Select
                value={parentCategoryId}
                onValueChange={setParentCategoryId}
              >
                <Select.Trigger>
                  <Select.Value placeholder="Select a parent category..." />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="none">None (Top Level Category)</Select.Item>
                  {availableParents.map((p) => (
                    <Select.Item key={p.id} value={p.id}>
                      {p.name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Description
              </Label>
              <Textarea
                placeholder="Describe what items belong in this category..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="border-t border-ui-border-base pt-4 flex flex-col gap-y-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <Text size="small" weight="plus">
                    Active Status
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    When inactive, category is hidden on storefronts.
                  </Text>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <Text size="small" weight="plus">
                    Internal Category
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    Internal categories are for administrative use only.
                  </Text>
                </div>
                <Switch
                  checked={isInternal}
                  onCheckedChange={setIsInternal}
                />
              </div>
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
              {isEditing ? "Save Changes" : "Create Category"}
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  )
}
