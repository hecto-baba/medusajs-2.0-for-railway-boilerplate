"use client"

import {
  createVendorCollection,
  updateVendorCollection,
  type VendorCollection,
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

type CollectionDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  collection?: VendorCollection | null
  onSuccess?: () => void
}

export const CollectionDrawer = ({
  open,
  onOpenChange,
  collection,
  onSuccess,
}: CollectionDrawerProps) => {
  const isEditing = Boolean(collection)
  const queryClient = useQueryClient()

  const [title, setTitle] = useState("")
  const [handle, setHandle] = useState("")

  useEffect(() => {
    if (collection) {
      setTitle(collection.title || "")
      setHandle(collection.handle || "")
    } else {
      setTitle("")
      setHandle("")
    }
  }, [collection, open])

  const createMutation = useMutation({
    mutationFn: (data: { title: string; handle?: string }) =>
      createVendorCollection(data),
    onSuccess: () => {
      toast.success("Collection created successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-collections"] })
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create collection")
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { title?: string; handle?: string }) =>
      updateVendorCollection(collection!.id, data),
    onSuccess: () => {
      toast.success("Collection updated successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-collections"] })
      queryClient.invalidateQueries({
        queryKey: ["vendor-collection", collection?.id],
      })
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update collection")
    },
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      toast.error("Title is required")
      return
    }

    const payload = {
      title: title.trim(),
      ...(handle.trim() ? { handle: handle.trim().toLowerCase() } : {}),
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
              {isEditing ? "Edit Collection" : "Create Collection"}
            </Heading>
          </Drawer.Title>
          <Drawer.Description className="text-ui-fg-subtle text-sm">
            {isEditing
              ? "Update collection details."
              : "Organize your products into a curated collection."}
          </Drawer.Description>
        </Drawer.Header>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col justify-between">
          <Drawer.Body className="flex flex-col gap-y-4 p-6">
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Title <span className="text-ui-fg-error">*</span>
              </Label>
              <Input
                placeholder="Summer Collection"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Handle
              </Label>
              <Input
                placeholder="summer-collection"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
              />
              <p className="text-ui-fg-muted text-xs">
                The slug used in store URLs. If left empty, it will be generated automatically.
              </p>
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
              {isEditing ? "Save Changes" : "Create Collection"}
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  )
}
