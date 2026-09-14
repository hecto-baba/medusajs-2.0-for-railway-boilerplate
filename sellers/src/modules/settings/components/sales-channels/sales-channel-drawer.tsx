"use client"

import {
  createVendorSalesChannel,
  updateVendorSalesChannel,
  type VendorSalesChannel,
} from "@lib/data/vendor-client"
import {
  Button,
  Drawer,
  Heading,
  Input,
  Label,
  Switch,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

type SalesChannelDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  salesChannel?: VendorSalesChannel | null
  onSuccess?: (sc: VendorSalesChannel) => void
}

export const SalesChannelDrawer = ({
  open,
  onOpenChange,
  salesChannel,
  onSuccess,
}: SalesChannelDrawerProps) => {
  const queryClient = useQueryClient()
  const isEditing = !!salesChannel

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isDisabled, setIsDisabled] = useState(false)

  useEffect(() => {
    if (salesChannel) {
      setName(salesChannel.name || "")
      setDescription(salesChannel.description || "")
      setIsDisabled(!!salesChannel.is_disabled)
    } else {
      setName("")
      setDescription("")
      setIsDisabled(false)
    }
  }, [salesChannel, open])

  const mutation = useMutation({
    mutationFn: async () => {
      if (isEditing) {
        return updateVendorSalesChannel(salesChannel!.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          is_disabled: isDisabled,
        })
      } else {
        return createVendorSalesChannel({
          name: name.trim(),
          description: description.trim() || undefined,
          is_disabled: isDisabled,
        })
      }
    },
    onSuccess: (res) => {
      toast.success(
        isEditing
          ? "Sales channel updated successfully"
          : "Sales channel created successfully"
      )
      queryClient.invalidateQueries({ queryKey: ["vendor-sales-channels"] })
      if (isEditing) {
        queryClient.invalidateQueries({
          queryKey: ["vendor-sales-channel", salesChannel?.id],
        })
      }
      onOpenChange(false)
      onSuccess?.(res.sales_channel)
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save sales channel")
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Sales channel name is required")
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
              {isEditing ? "Edit Sales Channel" : "Create Sales Channel"}
            </Heading>
          </Drawer.Title>
          <Drawer.Description className="text-ui-fg-subtle text-sm">
            {isEditing
              ? "Update sales channel properties."
              : "Specify a sales channel to control which products are available in specific markets or platforms."}
          </Drawer.Description>
        </Drawer.Header>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col justify-between overflow-y-auto">
          <Drawer.Body className="flex flex-col gap-y-4 p-6">
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Channel Name <span className="text-ui-fg-error">*</span>
              </Label>
              <Input
                placeholder="e.g. Mobile App, Web Store, B2B Portal"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Description
              </Label>
              <Textarea
                placeholder="Brief description of this channel..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4 bg-ui-bg-subtle">
              <div className="flex flex-col gap-y-0.5 pr-4">
                <Label size="small" weight="plus">
                  Disabled
                </Label>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Disabled channels won&apos;t process orders or publish products.
                </Text>
              </div>
              <Switch
                checked={isDisabled}
                onCheckedChange={setIsDisabled}
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
              {isEditing ? "Save Changes" : "Create Channel"}
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  )
}
