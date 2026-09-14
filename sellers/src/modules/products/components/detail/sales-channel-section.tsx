"use client"

import {
  getVendorTaxonomy,
  updateVendorProduct,
  type VendorProduct,
} from "@lib/data/vendor-client"
import { Button, Drawer, Select, Text, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Section } from "./section"

/**
 * Which sales channels the product is listed in.
 *
 * A product in no channel is invisible to every storefront, so the drawer
 * refuses to save an empty selection rather than letting a seller silently
 * unlist themselves.
 */
export const SalesChannelSection = ({ product }: { product: VendorProduct }) => {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])

  const channels = product.sales_channels ?? []

  const { data: taxonomy, isLoading } = useQuery({
    queryKey: ["vendor-taxonomy"],
    queryFn: getVendorTaxonomy,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })

  const { mutateAsync: save, isPending } = useMutation({
    mutationFn: () =>
      updateVendorProduct(product.id, {
        sales_channels: selected.map((id) => ({ id })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-product", product.id] })
      queryClient.invalidateQueries({ queryKey: ["vendor-products"] })
    },
  })

  const openDrawer = () => {
    setSelected(channels.map((channel) => channel.id))
    setOpen(true)
  }

  const onSave = async () => {
    if (!selected.length) {
      toast.error(
        "Choose at least one channel, or the product will not appear anywhere."
      )
      return
    }

    try {
      await save()
      toast.success("Sales channels updated.")
      setOpen(false)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update the sales channels."
      )
    }
  }

  const available = taxonomy?.sales_channels ?? []

  return (
    <Section
      title="Sales Channels"
      actions={
        <Button size="small" variant="secondary" onClick={openDrawer}>
          Edit
        </Button>
      }
    >
      <div className="flex flex-col gap-y-2 px-6 py-4">
        {channels.length ? (
          <>
            {channels.map((channel) => (
              <div
                key={channel.id}
                className="bg-ui-bg-subtle text-ui-fg-base txt-small rounded-md px-3 py-2"
              >
                {channel.name ?? "Unnamed channel"}
              </div>
            ))}
            <Text size="small" className="text-ui-fg-subtle">
              Available in {channels.length} of{" "}
              {available.length || channels.length} sales channels
            </Text>
          </>
        ) : (
          <Text size="small" className="text-ui-fg-muted">
            Not in any sales channel - shoppers cannot see this product.
          </Text>
        )}
      </div>

      <Drawer open={open} onOpenChange={setOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Edit sales channels</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-3 overflow-y-auto">
            {isLoading ? (
              <Text size="small" className="text-ui-fg-muted">
                Loading…
              </Text>
            ) : available.length ? (
              available.map((channel) => {
                const active = selected.includes(channel.id)

                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() =>
                      setSelected(
                        active
                          ? selected.filter((id) => id !== channel.id)
                          : [...selected, channel.id]
                      )
                    }
                    className={
                      "flex items-center justify-between rounded-md border px-3 py-2 text-left " +
                      (active
                        ? "border-ui-border-interactive bg-ui-bg-base"
                        : "border-ui-border-base")
                    }
                  >
                    <Text size="small" weight={active ? "plus" : "regular"}>
                      {channel.name}
                    </Text>
                    {active ? (
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        Selected
                      </Text>
                    ) : null}
                  </button>
                )
              })
            ) : (
              <Text size="small" className="text-ui-fg-muted">
                The store has no sales channels available.
              </Text>
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <Button
              size="small"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button size="small" onClick={onSave} isLoading={isPending}>
              Save
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Section>
  )
}

/**
 * Which shipping profile the product uses.
 *
 * The profile decides which shipping options a shopper is offered at
 * checkout, so a product without one cannot be delivered - hence the warning
 * rather than a silent dash.
 */
export const ShippingSection = ({ product }: { product: VendorProduct }) => {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [profileId, setProfileId] = useState("")

  const { data: taxonomy, isLoading } = useQuery({
    queryKey: ["vendor-taxonomy"],
    queryFn: getVendorTaxonomy,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })

  const { mutateAsync: save, isPending } = useMutation({
    mutationFn: () =>
      updateVendorProduct(product.id, { shipping_profile_id: profileId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-product", product.id] })
    },
  })

  const openDrawer = () => {
    setProfileId(product.shipping_profile?.id ?? "")
    setOpen(true)
  }

  const onSave = async () => {
    if (!profileId) {
      toast.error("Choose a shipping profile.")
      return
    }

    try {
      await save()
      toast.success("Shipping profile updated.")
      setOpen(false)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update the shipping profile."
      )
    }
  }

  return (
    <Section
      title="Shipping configuration"
      actions={
        <Button size="small" variant="secondary" onClick={openDrawer}>
          Edit
        </Button>
      }
    >
      <div className="px-6 py-4">
        {product.shipping_profile ? (
          <div className="bg-ui-bg-subtle rounded-md px-3 py-2">
            <Text size="small" weight="plus">
              {product.shipping_profile.name}
            </Text>
          </div>
        ) : (
          <Text size="small" className="text-ui-fg-muted">
            No shipping profile - this product cannot be delivered until one is
            set.
          </Text>
        )}
      </div>

      <Drawer open={open} onOpenChange={setOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Shipping configuration</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-3">
            {isLoading ? (
              <Text size="small" className="text-ui-fg-muted">
                Loading…
              </Text>
            ) : (
              <div className="flex flex-col gap-y-2">
                <Text size="small" weight="plus">
                  Shipping profile
                </Text>
                <Select value={profileId} onValueChange={setProfileId}>
                  <Select.Trigger>
                    <Select.Value placeholder="Choose a profile" />
                  </Select.Trigger>
                  <Select.Content>
                    {(taxonomy?.shipping_profiles ?? []).map((profile) => (
                      <Select.Item key={profile.id} value={profile.id}>
                        {profile.name}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <Button
              size="small"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button size="small" onClick={onSave} isLoading={isPending}>
              Save
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Section>
  )
}
