"use client"

import {
  listVendorProducts,
  listVendorResourceServices,
  setVendorResourceServices,
  type VendorResource,
  type VendorResourceService,
} from "@lib/data/vendor-client"
import {
  Badge,
  Button,
  Container,
  FocusModal,
  Heading,
  IconButton,
  Input,
  Label,
  Select,
  Table,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { Trash } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useEffect, useState } from "react"

type Entry = { product_id: string; duration_minutes: number | null; capacity: number | null }

const AddServiceModal = ({
  resource,
  existing,
  open,
  onOpenChange,
  onAdd,
  saving,
}: {
  resource: VendorResource
  existing: Set<string>
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (entry: Entry) => void
  saving: boolean
}) => {
  const [productId, setProductId] = useState("")
  const [duration, setDuration] = useState("")
  const [capacity, setCapacity] = useState("")

  // Start every opening from a clean form.
  useEffect(() => {
    if (open) {
      setProductId("")
      setDuration("")
      setCapacity("")
    }
  }, [open])

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-products-for-services"],
    queryFn: () => listVendorProducts({ limit: 100, offset: 0 }),
    enabled: open,
  })

  const choices = (data?.products ?? []).filter((p) => !existing.has(p.id))

  const durationValue = duration.trim() === "" ? null : Number(duration)
  const capacityValue = capacity.trim() === "" ? null : Number(capacity)
  const problem = !productId
    ? "Choose a service."
    : durationValue !== null && (!Number.isInteger(durationValue) || durationValue < 1 || durationValue > 1440)
      ? "Session length must be 1-1440 minutes (or empty)."
      : capacityValue !== null && (!Number.isInteger(capacityValue) || capacityValue < 1)
        ? "People per slot must be at least 1 (or empty)."
        : null

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content>
        <FocusModal.Header>
          <FocusModal.Title>Offer a service</FocusModal.Title>
        </FocusModal.Header>
        <FocusModal.Body className="flex flex-col items-center overflow-y-auto py-8">
          <div className="flex w-full max-w-lg flex-col gap-y-5">
            <div className="flex flex-col gap-y-1">
              <Label size="small" weight="plus">Service (one of your products)</Label>
              <Select value={productId} onValueChange={setProductId} disabled={isLoading}>
                <Select.Trigger>
                  <Select.Value placeholder={isLoading ? "Loading..." : "Choose a product"} />
                </Select.Trigger>
                <Select.Content>
                  {choices.map((p) => (
                    <Select.Item key={p.id} value={p.id}>
                      {p.title}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
              {!isLoading && !choices.length ? (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  No products left to add. Create a product first (its price is the service price).
                </Text>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-y-1">
                <Label size="small" weight="plus">Session length (min)</Label>
                <Input
                  type="number"
                  min={1}
                  value={duration}
                  placeholder={String(resource.session_duration_minutes)}
                  onChange={(e) => setDuration(e.target.value)}
                />
                <Text size="xsmall" className="text-ui-fg-subtle">Empty = the resource&rsquo;s default.</Text>
              </div>
              <div className="flex flex-col gap-y-1">
                <Label size="small" weight="plus">People per slot</Label>
                <Input
                  type="number"
                  min={1}
                  value={capacity}
                  placeholder={String(resource.capacity)}
                  onChange={(e) => setCapacity(e.target.value)}
                />
                <Text size="xsmall" className="text-ui-fg-subtle">Empty = the resource&rsquo;s default.</Text>
              </div>
            </div>
            <Text size="small" className="text-ui-fg-error">{problem}</Text>
          </div>
        </FocusModal.Body>
        <FocusModal.Footer>
          <div className="flex gap-x-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              disabled={!!problem || saving}
              isLoading={saving}
              onClick={() =>
                onAdd({ product_id: productId, duration_minutes: durationValue, capacity: capacityValue })
              }
            >
              Add service
            </Button>
          </div>
        </FocusModal.Footer>
      </FocusModal.Content>
    </FocusModal>
  )
}

export const ServicesTab = ({ resource }: { resource: VendorResource }) => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const [adding, setAdding] = useState(false)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["vendor-resource-services", resource.id],
    queryFn: () => listVendorResourceServices(resource.id),
  })

  const services = data?.services ?? []

  // While nothing is offered yet, show the seller's own products right here so one
  // click offers it (the same list the "Offer a service" window uses).
  const showQuickList = !isLoading && !isError && services.length === 0
  const products = useQuery({
    queryKey: ["vendor-products-for-services"],
    queryFn: () => listVendorProducts({ limit: 100, offset: 0 }),
    enabled: showQuickList,
  })

  const save = useMutation({
    mutationFn: (entries: Entry[]) => setVendorResourceServices(resource.id, entries),
    onSuccess: () => {
      toast.success("Services updated")
      queryClient.invalidateQueries({ queryKey: ["vendor-resource-services", resource.id] })
      queryClient.invalidateQueries({ queryKey: ["vendor-resource", resource.id] })
      queryClient.invalidateQueries({ queryKey: ["vendor-resources"] })
      setAdding(false)
    },
    onError: (e: any) => toast.error(e?.message || "Could not update services"),
  })

  const toEntries = (list: VendorResourceService[]): Entry[] =>
    list.map((s) => ({
      product_id: s.product_id,
      duration_minutes: s.duration_minutes,
      capacity: s.capacity,
    }))

  const remove = async (service: VendorResourceService) => {
    const ok = await prompt({
      title: "Stop offering this service?",
      description: `${service.product?.title ?? "This service"} will no longer be bookable with ${resource.display_name}. Existing bookings are not affected.`,
      confirmText: "Remove",
      cancelText: "Cancel",
      variant: "danger",
    })
    if (ok) save.mutate(toEntries(services.filter((s) => s.id !== service.id)))
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Services</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            The products this resource can be booked for. The price comes from the product.
          </Text>
        </div>
        <Button size="small" variant="secondary" onClick={() => setAdding(true)}>
          Offer a service
        </Button>
      </div>

      {isLoading ? (
        <div className="px-6 py-8"><Text size="small" className="text-ui-fg-subtle">Loading...</Text></div>
      ) : isError ? (
        <div className="px-6 py-8"><Text size="small" className="text-ui-fg-error">{(error as Error)?.message}</Text></div>
      ) : !services.length ? (
        <div className="flex flex-col">
          <div className="flex flex-col gap-y-1 px-6 py-4">
            <Text size="small" weight="plus">Nothing is offered yet</Text>
            <Text size="small" className="text-ui-fg-subtle">
              Choose one of your products below to offer it. Customers can book {resource.display_name ?? "this resource"} once at
              least one product is offered.
            </Text>
          </div>
          {products.isLoading ? (
            <div className="border-t px-6 py-4">
              <Text size="small" className="text-ui-fg-subtle">Loading your products...</Text>
            </div>
          ) : (products.data?.products ?? []).length ? (
            <ul className="divide-y border-t">
              {(products.data?.products ?? []).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-x-3 px-6 py-3">
                  <div className="flex items-center gap-x-2">
                    <Text size="small" weight="plus">{p.title}</Text>
                    {p.status !== "published" ? (
                      <Badge size="2xsmall" color="grey">{p.status}</Badge>
                    ) : null}
                  </div>
                  <Button
                    size="small"
                    variant="secondary"
                    disabled={save.isPending}
                    onClick={() =>
                      save.mutate([...toEntries(services), { product_id: p.id, duration_minutes: null, capacity: null }])
                    }
                  >
                    Offer
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-y-2 border-t px-6 py-8 text-center">
              <Text size="small" className="text-ui-fg-subtle">You have no products yet.</Text>
              <Link href="/products/new" className="text-ui-fg-interactive txt-small">
                Create a product
              </Link>
            </div>
          )}
          {(products.data?.products ?? []).length ? (
            <div className="border-t px-6 py-3">
              <Text size="small" className="text-ui-fg-subtle">
                Need something new?{" "}
                <Link href="/products/new" className="text-ui-fg-interactive">Create a product</Link>
              </Text>
            </div>
          ) : null}
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Service</Table.HeaderCell>
              <Table.HeaderCell>Session</Table.HeaderCell>
              <Table.HeaderCell>People</Table.HeaderCell>
              <Table.HeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {services.map((s) => (
              <Table.Row key={s.id}>
                <Table.Cell>
                  <Link href={`/products/${s.product_id}`} className="hover:underline">
                    <Text size="small" weight="plus">{s.product?.title ?? s.product_id}</Text>
                  </Link>
                </Table.Cell>
                <Table.Cell>
                  {s.duration_minutes ?? resource.session_duration_minutes} min
                  {s.duration_minutes ? "" : " (default)"}
                </Table.Cell>
                <Table.Cell>
                  {s.capacity ?? resource.capacity}
                  {s.capacity ? "" : " (default)"}
                </Table.Cell>
                <Table.Cell className="text-right">
                  <IconButton size="small" variant="transparent" aria-label="Remove service" onClick={() => remove(s)}>
                    <Trash />
                  </IconButton>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}

      <AddServiceModal
        resource={resource}
        existing={new Set(services.map((s) => s.product_id))}
        open={adding}
        onOpenChange={setAdding}
        saving={save.isPending}
        onAdd={(entry) => save.mutate([...toEntries(services), entry])}
      />
    </Container>
  )
}
