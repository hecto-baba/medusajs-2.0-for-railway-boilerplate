"use client"

import {
  createVendorCustomerGroup,
  updateVendorCustomerGroup,
  type VendorCustomerGroup,
} from "@lib/data/vendor-client"
import {
  Button,
  Drawer,
  Heading,
  Input,
  Label,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

type GroupDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  group?: VendorCustomerGroup | null
  onSuccess?: () => void
}

export const GroupDrawer = ({
  open,
  onOpenChange,
  group,
  onSuccess,
}: GroupDrawerProps) => {
  const isEditing = Boolean(group)
  const queryClient = useQueryClient()

  const [name, setName] = useState("")

  useEffect(() => {
    if (group) {
      setName(group.name || "")
    } else {
      setName("")
    }
  }, [group, open])

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => createVendorCustomerGroup(data),
    onSuccess: () => {
      toast.success("Customer group created successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-customer-groups"] })
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create customer group")
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      updateVendorCustomerGroup(group!.id, data),
    onSuccess: () => {
      toast.success("Customer group updated successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-customer-groups"] })
      queryClient.invalidateQueries({
        queryKey: ["vendor-customer-group", group?.id],
      })
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update customer group")
    },
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error("Group name is required")
      return
    }

    const payload = {
      name: name.trim(),
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
              {isEditing ? "Edit Customer Group" : "Create Customer Group"}
            </Heading>
          </Drawer.Title>
          <Drawer.Description className="text-ui-fg-subtle text-sm">
            {isEditing
              ? "Update the customer group name."
              : "Create a customer group to organize and segment your buyers."}
          </Drawer.Description>
        </Drawer.Header>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col justify-between">
          <Drawer.Body className="flex flex-col gap-y-4 p-6">
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Group Name <span className="text-ui-fg-error">*</span>
              </Label>
              <Input
                placeholder="e.g. VIP Buyers, Wholesale, Early Adopters"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
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
              {isEditing ? "Save Changes" : "Create Group"}
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  )
}
