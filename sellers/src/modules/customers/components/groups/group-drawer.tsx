"use client"

import {
  updateVendorCustomerGroup,
  type VendorCustomerGroup,
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
  const queryClient = useQueryClient()
  const [name, setName] = useState("")

  useEffect(() => {
    if (group) {
      setName(group.name || "")
    } else {
      setName("")
    }
  }, [group, open])

  const updateMutation = useMutation({
    mutationFn: (data: { name: string }) =>
      updateVendorCustomerGroup(group!.id, data),
    onSuccess: (data) => {
      const updated = data.customer_group
      toast.success(`Customer group ${updated.name} was successfully updated.`)
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!group) return

    if (!name.trim()) {
      toast.error("Name is required")
      return
    }

    updateMutation.mutate({ name: name.trim() })
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content className="max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col justify-between overflow-hidden">
          <Drawer.Header>
            <Drawer.Title asChild>
              <Heading level="h2">Edit Customer Group</Heading>
            </Drawer.Title>
            <Drawer.Description className="sr-only">
              Edit customer group details
            </Drawer.Description>
          </Drawer.Header>

          <Drawer.Body className="flex flex-1 flex-col gap-y-4 p-6 overflow-y-auto">
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Name
              </Label>
              <Input
                size="small"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </Drawer.Body>

          <Drawer.Footer className="flex items-center justify-end gap-x-2 border-t p-6">
            <Drawer.Close asChild>
              <Button
                type="button"
                variant="secondary"
                size="small"
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
            </Drawer.Close>
            <Button
              type="submit"
              size="small"
              variant="primary"
              isLoading={updateMutation.isPending}
            >
              Save
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  )
}
