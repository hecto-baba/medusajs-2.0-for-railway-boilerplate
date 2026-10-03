"use client"

import {
  createVendorShippingOption,
  deleteVendorShippingOption,
  listVendorShippingOptionTypes,
  listVendorShippingOptions,
  listVendorShippingProfiles,
  listVendorStockLocations,
  type VendorShippingOption,
} from "@lib/data/vendor-client"
import { PlusMini, Trash } from "@medusajs/icons"
import {
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Select,
  Table,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"

const QUERY_KEY = "vendor-shipping-options"

const formatPrice = (option: VendorShippingOption) =>
  (option.prices ?? [])
    .filter((price) => price.currency_code)
    .map((price) => `${price.amount} ${price.currency_code?.toUpperCase()}`)
    .join(", ") || "-"

export const ShippingOptionsCard = () => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [zoneId, setZoneId] = useState("")
  const [profileId, setProfileId] = useState("")
  const [typeId, setTypeId] = useState("")
  const [currency, setCurrency] = useState("usd")
  const [amount, setAmount] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEY],
    queryFn: () => listVendorShippingOptions({ limit: 100 }),
  })

  // A shipping option lives in a service zone of one of the seller's own locations.
  const { data: locations } = useQuery({
    queryKey: ["vendor-stock-locations", "for-shipping-options"],
    queryFn: () => listVendorStockLocations({ limit: 100 }),
    enabled: createOpen,
  })
  const { data: profiles } = useQuery({
    queryKey: ["vendor-shipping-profiles", "for-shipping-options"],
    queryFn: () => listVendorShippingProfiles({ limit: 100 }),
    enabled: createOpen,
  })
  const { data: types } = useQuery({
    queryKey: ["vendor-shipping-option-types", "for-shipping-options"],
    queryFn: () => listVendorShippingOptionTypes({ limit: 100 }),
    enabled: createOpen,
  })

  const zones = useMemo(
    () =>
      (locations?.stock_locations ?? []).flatMap((location) =>
        (location.fulfillment_sets ?? []).flatMap((set: any) =>
          (set.service_zones ?? []).map((zone: any) => ({
            id: zone.id as string,
            label: `${location.name} (${zone.name})`,
          }))
        )
      ),
    [locations]
  )

  const reset = () => {
    setName("")
    setZoneId("")
    setProfileId("")
    setTypeId("")
    setCurrency("usd")
    setAmount("")
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createVendorShippingOption({
        name: name.trim(),
        service_zone_id: zoneId,
        shipping_profile_id: profileId,
        shipping_option_type_id: typeId,
        prices: [{ currency_code: currency.trim().toLowerCase(), amount: Number(amount) }],
      }),
    onSuccess: () => {
      toast.success("Shipping option created")
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
      setCreateOpen(false)
      reset()
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create shipping option"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVendorShippingOption(id),
    onSuccess: () => {
      toast.success("Shipping option deleted")
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete shipping option"),
  })

  const handleDelete = async (option: VendorShippingOption) => {
    const confirmed = await prompt({
      title: "Delete shipping option",
      description: `Delete "${option.name}"? Buyers will no longer see it at checkout.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    })
    if (confirmed) {
      deleteMutation.mutate(option.id)
    }
  }

  const handleCreate = () => {
    if (!name.trim() || !zoneId || !profileId || !typeId || amount === "" || Number.isNaN(Number(amount))) {
      toast.error("Fill in every field")
      return
    }
    createMutation.mutate()
  }

  const options = data?.shipping_options ?? []

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Shipping Options</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            The delivery choices buyers see at checkout for your products.
          </Text>
        </div>
        <Button size="small" variant="secondary" onClick={() => setCreateOpen(true)}>
          <PlusMini /> Create
        </Button>
      </div>

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Name</Table.HeaderCell>
            <Table.HeaderCell>Location</Table.HeaderCell>
            <Table.HeaderCell>Type</Table.HeaderCell>
            <Table.HeaderCell>Price</Table.HeaderCell>
            <Table.HeaderCell className="w-12" />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {options.map((option) => (
            <Table.Row key={option.id}>
              <Table.Cell>{option.name}</Table.Cell>
              <Table.Cell>{option.service_zone?.fulfillment_set?.location?.name ?? "-"}</Table.Cell>
              <Table.Cell>{option.type?.label ?? "-"}</Table.Cell>
              <Table.Cell>{formatPrice(option)}</Table.Cell>
              <Table.Cell>
                <Button
                  size="small"
                  variant="transparent"
                  onClick={() => handleDelete(option)}
                  aria-label={`Delete ${option.name}`}
                >
                  <Trash />
                </Button>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>

      {!isLoading && options.length === 0 && (
        <div className="px-6 py-10 text-center">
          <Text size="small" className="text-ui-fg-subtle">
            No shipping options yet. Add a location with an address first, then create an option so buyers can
            choose delivery for your products.
          </Text>
        </div>
      )}

      <Drawer open={createOpen} onOpenChange={setCreateOpen}>
        <Drawer.Content className="max-w-md">
          <Drawer.Header>
            <Drawer.Title>Create shipping option</Drawer.Title>
            <Drawer.Description className="text-ui-fg-subtle text-sm">
              Delivers from one of your locations, for products on your own shipping profile.
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-4 p-6">
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">Name</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Standard delivery" />
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">Location</Label>
              <Select value={zoneId} onValueChange={setZoneId}>
                <Select.Trigger>
                  <Select.Value placeholder="Choose a location" />
                </Select.Trigger>
                <Select.Content>
                  {zones.map((zone) => (
                    <Select.Item key={zone.id} value={zone.id}>{zone.label}</Select.Item>
                  ))}
                </Select.Content>
              </Select>
              {locations && zones.length === 0 && (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  None of your locations can ship yet. Give a location an address with a country.
                </Text>
              )}
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">Shipping profile</Label>
              <Select value={profileId} onValueChange={setProfileId}>
                <Select.Trigger>
                  <Select.Value placeholder="Choose your profile" />
                </Select.Trigger>
                <Select.Content>
                  {(profiles?.shipping_profiles ?? []).map((profile) => (
                    <Select.Item key={profile.id} value={profile.id}>{profile.name}</Select.Item>
                  ))}
                </Select.Content>
              </Select>
              <Text size="xsmall" className="text-ui-fg-subtle">
                Use your own profile, the one your products are on.
              </Text>
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">Option type</Label>
              <Select value={typeId} onValueChange={setTypeId}>
                <Select.Trigger>
                  <Select.Value placeholder="Choose a type" />
                </Select.Trigger>
                <Select.Content>
                  {(types?.shipping_option_types ?? []).map((type) => (
                    <Select.Item key={type.id} value={type.id}>{type.label}</Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">Currency</Label>
                <Input value={currency} onChange={(event) => setCurrency(event.target.value)} maxLength={3} />
              </div>
              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">Price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
            </div>
          </Drawer.Body>
          <Drawer.Footer className="flex items-center justify-end gap-x-2 border-t p-6">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} isLoading={createMutation.isPending}>Create</Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}
