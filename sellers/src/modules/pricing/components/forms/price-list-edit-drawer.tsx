"use client"

import {
  updateVendorPriceList,
  type VendorPriceList,
} from "@lib/data/vendor-client"
import {
  Button,
  Drawer,
  Heading,
  Input,
  Label,
  RadioGroup,
  Select,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

type PriceListEditDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  priceList: VendorPriceList
  onSuccess?: () => void
}

export const PriceListEditDrawer = ({
  open,
  onOpenChange,
  priceList,
  onSuccess,
}: PriceListEditDrawerProps) => {
  const queryClient = useQueryClient()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState<"sale" | "override">("sale")
  const [status, setStatus] = useState<"active" | "draft">("active")

  useEffect(() => {
    if (priceList && open) {
      setTitle(priceList.title || "")
      setDescription(priceList.description || "")
      setType(priceList.type || "sale")
      setStatus(priceList.status || "active")
    }
  }, [priceList, open])

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      updateVendorPriceList(priceList.id, payload),
    onSuccess: ({ price_list }) => {
      toast.success(`Price list ${price_list.title} was successfully updated.`)
      queryClient.invalidateQueries({
        queryKey: ["vendor-price-list", priceList.id],
      })
      queryClient.invalidateQueries({ queryKey: ["vendor-price-lists"] })
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update price list")
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      toast.error("Title is required")
      return
    }

    updateMutation.mutate({
      title: title.trim(),
      description: description.trim() || null,
      type,
      status,
    })
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content className="max-w-md flex flex-col justify-between">
        <Drawer.Header className="border-b px-6 py-4">
          <Drawer.Title asChild>
            <Heading level="h2">Edit Price List</Heading>
          </Drawer.Title>
        </Drawer.Header>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col justify-between overflow-hidden">
          <Drawer.Body className="flex flex-1 flex-col gap-y-6 p-6 overflow-y-auto">
            {/* Type */}
            <div className="flex flex-col gap-y-3">
              <div>
                <Label size="small" weight="plus">
                  Type
                </Label>
                <Text size="small" className="text-ui-fg-subtle">
                  Choose the type of price list you want to create.
                </Text>
              </div>

              <RadioGroup
                value={type}
                onValueChange={(v: any) => setType(v)}
                className="grid grid-cols-1 gap-3"
              >
                <RadioGroup.ChoiceBox
                  value="sale"
                  label="Sale"
                  description="Sale prices are temporary price changes for products."
                />
                <RadioGroup.ChoiceBox
                  value="override"
                  label="Override"
                  description="Overrides are usually used to create customer-specific prices."
                />
              </RadioGroup>
            </div>

            {/* Title, Status, Description */}
            <div className="flex flex-col gap-y-4">
              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Title <span className="text-ui-fg-error">*</span>
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Status
                </Label>
                <Select
                  value={status}
                  onValueChange={(val: any) => setStatus(val)}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="active">Active</Select.Item>
                    <Select.Item value="draft">Draft</Select.Item>
                  </Select.Content>
                </Select>
              </div>

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Description
                </Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
          </Drawer.Body>

          <Drawer.Footer className="flex items-center justify-end gap-x-2 border-t p-6 bg-ui-bg-base">
            <Button
              type="button"
              variant="secondary"
              size="small"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="small"
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
