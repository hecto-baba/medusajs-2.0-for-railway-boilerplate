"use client"

import {
  listVendorCustomerGroups,
  updateVendorPriceList,
  type VendorPriceList,
} from "@lib/data/vendor-client"
import { MagnifyingGlass, XMarkMini } from "@medusajs/icons"
import {
  Button,
  DatePicker,
  Divider,
  Drawer,
  Heading,
  IconButton,
  Label,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import {
  PriceListCustomerGroupRuleForm,
  type CustomerGroupItem,
} from "./price-list-customer-group-rule-form"

type PriceListConfigurationDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  priceList: VendorPriceList
  onSuccess?: () => void
}

export const PriceListConfigurationDrawer = ({
  open,
  onOpenChange,
  priceList,
  onSuccess,
}: PriceListConfigurationDrawerProps) => {
  const queryClient = useQueryClient()

  const [startsAt, setStartsAt] = useState<Date | null>(null)
  const [endsAt, setEndsAt] = useState<Date | null>(null)
  const [customerGroups, setCustomerGroups] = useState<CustomerGroupItem[]>([])
  const [isBrowseOpen, setIsBrowseOpen] = useState(false)

  // Fetch all customer groups to map rule IDs to objects
  const { data: groupsData } = useQuery({
    queryKey: ["vendor-customer-groups", { limit: 100, offset: 0 }],
    queryFn: () => listVendorCustomerGroups({ limit: 100, offset: 0 }),
    enabled: open,
  })

  useEffect(() => {
    if (priceList && open) {
      setStartsAt(priceList.starts_at ? new Date(priceList.starts_at) : null)
      setEndsAt(priceList.ends_at ? new Date(priceList.ends_at) : null)

      const ruleIds =
        priceList.rules?.["customer.groups.id"] ||
        priceList.rules?.["customer_group_id"] ||
        []

      if (groupsData?.customer_groups) {
        const mapped = groupsData.customer_groups
          .filter((g) => ruleIds.includes(g.id))
          .map((g) => ({ id: g.id, name: g.name }))
        setCustomerGroups(mapped)
      } else if (ruleIds.length) {
        setCustomerGroups(ruleIds.map((id) => ({ id, name: id })))
      } else {
        setCustomerGroups([])
      }
    }
  }, [priceList, groupsData, open])

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      updateVendorPriceList(priceList.id, payload),
    onSuccess: () => {
      toast.success("Price list configuration was successfully updated.")
      queryClient.invalidateQueries({
        queryKey: ["vendor-price-list", priceList.id],
      })
      queryClient.invalidateQueries({ queryKey: ["vendor-price-lists"] })
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update configuration")
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const rules = { ...(priceList.rules || {}) }
    if (customerGroups.length) {
      rules["customer.groups.id"] = customerGroups.map((g) => g.id)
    } else {
      delete rules["customer.groups.id"]
      delete rules["customer_group_id"]
    }

    updateMutation.mutate({
      starts_at: startsAt ? startsAt.toISOString() : null,
      ends_at: endsAt ? endsAt.toISOString() : null,
      rules: Object.keys(rules).length ? rules : undefined,
    })
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content className="max-w-md flex flex-col justify-between">
        <Drawer.Header className="border-b px-6 py-4">
          <Drawer.Title asChild>
            <Heading level="h2">Edit Price List Configuration</Heading>
          </Drawer.Title>
          <Drawer.Description className="text-ui-fg-subtle text-sm">
            Edit the configuration of the price list.
          </Drawer.Description>
        </Drawer.Header>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col justify-between overflow-hidden">
          <Drawer.Body className="flex flex-1 flex-col gap-y-6 p-6 overflow-y-auto">
            {/* Starts At */}
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Price list has a start date?
              </Label>
              <Text size="xsmall" className="text-ui-fg-subtle">
                Schedule the price list to activate in the future.
              </Text>
              <DatePicker
                granularity="minute"
                shouldCloseOnSelect={false}
                value={startsAt ?? undefined}
                onChange={(d) => setStartsAt(d ?? null)}
              />
            </div>

            <Divider />

            {/* Ends At */}
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Price list has an expiry date?
              </Label>
              <Text size="xsmall" className="text-ui-fg-subtle">
                Schedule the price list to deactivate in the future.
              </Text>
              <DatePicker
                granularity="minute"
                shouldCloseOnSelect={false}
                value={endsAt ?? undefined}
                onChange={(d) => setEndsAt(d ?? null)}
              />
            </div>

            <Divider />

            {/* Customer Availability */}
            <div className="flex flex-col gap-y-3">
              <div>
                <Label size="small" weight="plus">
                  Customer availability
                </Label>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Choose which customer groups the price list should be applied to.
                </Text>
              </div>

              <div className="bg-ui-bg-component shadow-elevation-card-rest rounded-xl p-2 flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2 text-ui-fg-subtle text-xs">
                  <div className="bg-ui-bg-field shadow-borders-base rounded-md px-3 py-1.5 font-medium">
                    Customer groups
                  </div>
                  <div className="bg-ui-bg-field shadow-borders-base rounded-md px-3 py-1.5 font-medium">
                    In
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBrowseOpen(true)}
                    className="bg-ui-bg-field hover:bg-ui-bg-field-hover shadow-borders-base text-ui-fg-muted text-xs flex flex-1 items-center gap-x-2 rounded-md px-3 py-2 outline-none transition-colors"
                  >
                    <MagnifyingGlass className="h-4 w-4" />
                    <span>Search for customer groups</span>
                  </button>
                  <Button
                    variant="secondary"
                    size="small"
                    type="button"
                    onClick={() => setIsBrowseOpen(true)}
                  >
                    Browse
                  </Button>
                </div>

                {customerGroups.length > 0 && (
                  <div className="flex flex-col gap-1.5 border-t border-dashed pt-2">
                    {customerGroups.map((cg, idx) => (
                      <div
                        key={cg.id}
                        className="bg-ui-bg-field-component shadow-borders-base flex items-center justify-between gap-2 rounded-md px-3 py-1 text-xs"
                      >
                        <Text size="small" weight="plus">
                          {cg.name}
                        </Text>
                        <IconButton
                          size="small"
                          variant="transparent"
                          type="button"
                          onClick={() =>
                            setCustomerGroups((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                        >
                          <XMarkMini className="h-4 w-4" />
                        </IconButton>
                      </div>
                    ))}
                  </div>
                )}
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

        {/* Nested Drawer for customer groups */}
        {isBrowseOpen && (
          <Drawer open={isBrowseOpen} onOpenChange={setIsBrowseOpen}>
            <Drawer.Content className="max-w-md flex flex-col justify-between">
              <Drawer.Header className="border-b px-6 py-4">
                <Drawer.Title asChild>
                  <Heading level="h2">Choose customer groups</Heading>
                </Drawer.Title>
              </Drawer.Header>
              <Drawer.Body className="p-0 flex-1 overflow-hidden">
                <PriceListCustomerGroupRuleForm
                  state={customerGroups}
                  setState={setCustomerGroups}
                  onClose={() => setIsBrowseOpen(false)}
                />
              </Drawer.Body>
            </Drawer.Content>
          </Drawer>
        )}
      </Drawer.Content>
    </Drawer>
  )
}
