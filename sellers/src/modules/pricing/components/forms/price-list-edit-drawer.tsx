"use client"

import {
  listVendorCustomerGroups,
  updateVendorPriceList,
  type VendorPriceList,
} from "@lib/data/vendor-client"
import {
  Button,
  Checkbox,
  DatePicker,
  Drawer,
  Heading,
  Input,
  Label,
  RadioGroup,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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
  const [startsAt, setStartsAt] = useState<Date | null>(null)
  const [endsAt, setEndsAt] = useState<Date | null>(null)
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])

  // Fetch vendor customer groups
  const { data: groupsData } = useQuery({
    queryKey: ["vendor-customer-groups", { limit: 100, offset: 0 }],
    queryFn: () => listVendorCustomerGroups({ limit: 100, offset: 0 }),
    enabled: open,
  })
  const customerGroups = groupsData?.customer_groups ?? []

  useEffect(() => {
    if (priceList) {
      setTitle(priceList.title || "")
      setDescription(priceList.description || "")
      setType(priceList.type || "sale")
      setStatus(priceList.status || "active")
      setStartsAt(priceList.starts_at ? new Date(priceList.starts_at) : null)
      setEndsAt(priceList.ends_at ? new Date(priceList.ends_at) : null)
      setSelectedGroupIds(priceList.rules?.customer_group_id ?? [])
    }
  }, [priceList, open])

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      updateVendorPriceList(priceList.id, payload),
    onSuccess: () => {
      toast.success("Price list updated successfully")
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

  const toggleGroup = (groupId: string) => {
    if (selectedGroupIds.includes(groupId)) {
      setSelectedGroupIds(selectedGroupIds.filter((id) => id !== groupId))
    } else {
      setSelectedGroupIds([...selectedGroupIds, groupId])
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      toast.error("Title is required")
      return
    }

    const rules: Record<string, string[]> = {}
    if (selectedGroupIds.length) {
      rules.customer_group_id = selectedGroupIds
    }

    const payload: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() || null,
      type,
      status,
      starts_at: startsAt ? startsAt.toISOString() : null,
      ends_at: endsAt ? endsAt.toISOString() : null,
      rules: Object.keys(rules).length ? rules : undefined,
    }

    updateMutation.mutate(payload)
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content className="max-w-md">
        <Drawer.Header>
          <Drawer.Title asChild>
            <Heading level="h2">Edit Price List</Heading>
          </Drawer.Title>
          <Drawer.Description className="text-ui-fg-subtle text-sm">
            Update general details, status, and rules.
          </Drawer.Description>
        </Drawer.Header>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col justify-between">
          <Drawer.Body className="flex flex-col gap-y-4 p-6 overflow-y-auto">
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Title <span className="text-ui-fg-error">*</span>
              </Label>
              <Input
                placeholder="Summer Sale"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Description
              </Label>
              <Input
                placeholder="Description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Type
              </Label>
              <RadioGroup
                value={type}
                onValueChange={(val: any) => setType(val)}
                className="flex flex-col gap-y-2"
              >
                <div className="flex items-center gap-x-2 border rounded-md p-2">
                  <RadioGroup.Item value="sale" id="edit-type-sale" />
                  <label htmlFor="edit-type-sale" className="text-xs cursor-pointer">
                    Sale (Strikethrough original prices)
                  </label>
                </div>
                <div className="flex items-center gap-x-2 border rounded-md p-2">
                  <RadioGroup.Item value="override" id="edit-type-override" />
                  <label htmlFor="edit-type-override" className="text-xs cursor-pointer">
                    Override (Direct replacement price)
                  </label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Status
              </Label>
              <RadioGroup
                value={status}
                onValueChange={(val: any) => setStatus(val)}
                className="flex flex-col gap-y-2"
              >
                <div className="flex items-center gap-x-2 border rounded-md p-2">
                  <RadioGroup.Item value="active" id="edit-status-active" />
                  <label htmlFor="edit-status-active" className="text-xs cursor-pointer">
                    Active
                  </label>
                </div>
                <div className="flex items-center gap-x-2 border rounded-md p-2">
                  <RadioGroup.Item value="draft" id="edit-status-draft" />
                  <label htmlFor="edit-status-draft" className="text-xs cursor-pointer">
                    Draft
                  </label>
                </div>
              </RadioGroup>
            </div>

            <div className="border-t pt-3 flex flex-col gap-y-3">
              <Label size="small" weight="plus">
                Validity Schedule
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Text size="xsmall" className="text-ui-fg-muted mb-1">
                    Starts at
                  </Text>
                  <DatePicker
                    value={startsAt ?? undefined}
                    onChange={(date) => setStartsAt(date ?? null)}
                  />
                </div>
                <div>
                  <Text size="xsmall" className="text-ui-fg-muted mb-1">
                    Ends at
                  </Text>
                  <DatePicker
                    value={endsAt ?? undefined}
                    onChange={(date) => setEndsAt(date ?? null)}
                  />
                </div>
              </div>
            </div>

            {customerGroups.length > 0 && (
              <div className="border-t pt-3 flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Customer Groups Rules
                </Label>
                <div className="border rounded-md divide-y max-h-36 overflow-y-auto">
                  {customerGroups.map((group) => {
                    const isChecked = selectedGroupIds.includes(group.id)
                    return (
                      <div
                        key={group.id}
                        className="flex items-center gap-x-2 p-2 hover:bg-ui-bg-subtle cursor-pointer text-xs"
                        onClick={() => toggleGroup(group.id)}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleGroup(group.id)}
                        />
                        <span className="font-medium">{group.name}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </Drawer.Body>

          <Drawer.Footer className="flex items-center justify-end gap-x-2 border-t p-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={updateMutation.isPending}>
              Save Changes
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  )
}
