"use client"

import {
  cancelVendorFulfillment,
  cancelVendorOrder,
  deliverVendorFulfillment,
  fulfillVendorOrder,
  listVendorStockLocations,
  refundVendorOrder,
  returnVendorOrderItems,
  shipVendorFulfillment,
  type VendorFulfillment,
  type VendorOrderDetail,
} from "@lib/data/vendor-client"
import {
  Button,
  Checkbox,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Select,
  StatusBadge,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

/** Quantities come back as numbers or as { value: "2" } objects. */
const num = (value: unknown): number => {
  if (value === null || value === undefined) return 0
  if (typeof value === "number") return value
  if (typeof value === "object") return num((value as any).numeric_ ?? (value as any).value)
  const parsed = Number(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

type Action = null | "fulfil" | "ship" | "refund" | "return"

const fulfilmentState = (fulfillment: VendorFulfillment) =>
  fulfillment.canceled_at
    ? { label: "Canceled", color: "red" as const }
    : fulfillment.delivered_at
      ? { label: "Delivered", color: "green" as const }
      : fulfillment.shipped_at
        ? { label: "Shipped", color: "blue" as const }
        : { label: "Packed", color: "orange" as const }

type OrderActionsProps = {
  order: VendorOrderDetail
}

/**
 * Everything a seller can do to their own order: pack items, ship with tracking,
 * mark delivered, cancel a fulfilment or the order, refund the buyer, record a
 * return. Every button calls a /vendors/orders/:id/... route that checks the
 * order, items, shipping option and location belong to the seller; this screen
 * only makes them reachable. Cancel, refund and return are hidden on an older
 * order shared with other sellers.
 */
export const OrderActions = ({ order }: OrderActionsProps) => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [action, setAction] = useState<Action>(null)
  const [shipFor, setShipFor] = useState<string | null>(null)
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [optionId, setOptionId] = useState("")
  const [notify, setNotify] = useState(true)
  const [tracking, setTracking] = useState("")
  const [trackingUrl, setTrackingUrl] = useState("")
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [received, setReceived] = useState(true)
  const [locationId, setLocationId] = useState("")

  const items = order.items ?? []
  const fulfillments = order.fulfillments ?? []
  const methods = (order.shipping_methods ?? []).filter((method) => method.shipping_option_id)
  const canceled = order.status === "canceled" || order.status === "cancelled"
  const shared = !!order.is_mixed

  const unfulfilled = items
    .map((item) => ({ item, left: num(item.detail?.quantity ?? item.quantity) - num(item.detail?.fulfilled_quantity) }))
    .filter((row) => row.left > 0)

  const { data: locations } = useQuery({
    queryKey: ["vendor-stock-locations", "for-returns"],
    queryFn: () => listVendorStockLocations({ limit: 100 }),
    enabled: action === "return",
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["vendor-order", order.id] })
    queryClient.invalidateQueries({ queryKey: ["vendor-orders"] })
  }

  const close = () => {
    setAction(null)
    setShipFor(null)
    setQuantities({})
    setTracking("")
    setTrackingUrl("")
    setAmount("")
    setNote("")
  }

  const fail = (error: Error) => toast.error(error.message || "Something went wrong")

  const fulfilMutation = useMutation({
    mutationFn: () =>
      fulfillVendorOrder(order.id, {
        items: Object.entries(quantities)
          .filter(([, quantity]) => Number(quantity) > 0)
          .map(([id, quantity]) => ({ id, quantity: Number(quantity) })),
        shipping_option_id: optionId || (methods[0]?.shipping_option_id as string),
        no_notification: !notify,
      }),
    onSuccess: () => {
      toast.success("Items packed")
      refresh()
      close()
    },
    onError: fail,
  })

  const shipMutation = useMutation({
    mutationFn: () =>
      shipVendorFulfillment(order.id, shipFor as string, {
        labels: tracking.trim()
          ? [{ tracking_number: tracking.trim(), tracking_url: trackingUrl.trim() || undefined }]
          : undefined,
        no_notification: !notify,
      }),
    onSuccess: () => {
      toast.success("Marked as shipped")
      refresh()
      close()
    },
    onError: fail,
  })

  const deliverMutation = useMutation({
    mutationFn: (fulfillmentId: string) => deliverVendorFulfillment(order.id, fulfillmentId),
    onSuccess: () => {
      toast.success("Marked as delivered")
      refresh()
    },
    onError: fail,
  })

  const cancelFulfilmentMutation = useMutation({
    mutationFn: (fulfillmentId: string) => cancelVendorFulfillment(order.id, fulfillmentId),
    onSuccess: () => {
      toast.success("Fulfilment canceled")
      refresh()
    },
    onError: fail,
  })

  const cancelOrderMutation = useMutation({
    mutationFn: () => cancelVendorOrder(order.id),
    onSuccess: () => {
      toast.success("Order canceled")
      refresh()
    },
    onError: fail,
  })

  const refundMutation = useMutation({
    mutationFn: () => refundVendorOrder(order.id, { amount: Number(amount), note: note.trim() || undefined }),
    onSuccess: () => {
      toast.success("Refund sent to the buyer")
      refresh()
      close()
    },
    onError: fail,
  })

  const returnMutation = useMutation({
    mutationFn: () =>
      returnVendorOrderItems(order.id, {
        items: Object.entries(quantities)
          .filter(([, quantity]) => Number(quantity) > 0)
          .map(([id, quantity]) => ({ id, quantity: Number(quantity) })),
        note: note.trim() || undefined,
        receive_now: received,
        location_id: received ? locationId || locations?.stock_locations?.[0]?.id : undefined,
      }),
    onSuccess: () => {
      toast.success("Return recorded")
      refresh()
      close()
    },
    onError: fail,
  })

  const confirmCancelOrder = async () => {
    const confirmed = await prompt({
      title: "Cancel this order",
      description: "The buyer will not receive these items and the stock is released. This cannot be undone.",
      confirmText: "Cancel order",
      cancelText: "Keep order",
    })
    if (confirmed) cancelOrderMutation.mutate()
  }

  const confirmCancelFulfilment = async (fulfillmentId: string) => {
    const confirmed = await prompt({
      title: "Cancel this fulfilment",
      description: "The items go back to unpacked and the stock is returned to your location.",
      confirmText: "Cancel fulfilment",
      cancelText: "Keep",
    })
    if (confirmed) cancelFulfilmentMutation.mutate(fulfillmentId)
  }

  const openFulfil = () => {
    setQuantities(Object.fromEntries(unfulfilled.map((row) => [row.item.id, String(row.left)])))
    setOptionId(methods[0]?.shipping_option_id as string)
    setNotify(true)
    setAction("fulfil")
  }

  const openShip = (fulfillmentId: string) => {
    setShipFor(fulfillmentId)
    setNotify(true)
    setAction("ship")
  }

  const openReturn = () => {
    setQuantities(Object.fromEntries(items.map((item) => [item.id, "0"])))
    setReceived(true)
    setAction("return")
  }

  const submitFulfil = () => {
    if (!Object.values(quantities).some((q) => Number(q) > 0)) return toast.error("Choose at least one item")
    if (!(optionId || methods[0]?.shipping_option_id)) return toast.error("This order has no shipping method")
    fulfilMutation.mutate()
  }

  const submitRefund = () => {
    if (!(Number(amount) > 0)) return toast.error("Enter an amount")
    refundMutation.mutate()
  }

  const submitReturn = () => {
    if (!Object.values(quantities).some((q) => Number(q) > 0)) return toast.error("Choose at least one item")
    returnMutation.mutate()
  }

  return (
    <>
      <Container className="p-6 flex flex-col gap-y-4" data-testid="order-fulfilment">
        <div className="flex items-center justify-between">
          <Heading level="h2">Fulfilment</Heading>
          <Button size="small" variant="secondary" disabled={canceled || unfulfilled.length === 0} onClick={openFulfil}>
            Fulfil items
          </Button>
        </div>

        {fulfillments.length === 0 ? (
          <Text size="small" className="text-ui-fg-subtle">
            Nothing packed yet.
          </Text>
        ) : (
          <div className="flex flex-col gap-y-3">
            {fulfillments.map((fulfillment) => {
              const state = fulfilmentState(fulfillment)
              const done = !!fulfillment.canceled_at
              return (
                <div key={fulfillment.id} className="rounded-lg border p-3 flex flex-col gap-y-2">
                  <div className="flex items-center justify-between">
                    <StatusBadge color={state.color}>{state.label}</StatusBadge>
                    <div className="flex items-center gap-x-2">
                      {!done && !fulfillment.shipped_at && (
                        <Button size="small" variant="secondary" onClick={() => openShip(fulfillment.id)}>
                          Mark shipped
                        </Button>
                      )}
                      {!done && fulfillment.shipped_at && !fulfillment.delivered_at && (
                        <Button size="small" variant="secondary" onClick={() => deliverMutation.mutate(fulfillment.id)}>
                          Mark delivered
                        </Button>
                      )}
                      {!done && !fulfillment.delivered_at && (
                        <Button size="small" variant="transparent" onClick={() => confirmCancelFulfilment(fulfillment.id)}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                  {(fulfillment.items ?? []).map((item, index) => (
                    <Text key={`${item.line_item_id}-${index}`} size="small" className="text-ui-fg-subtle">
                      {num(item.quantity)} x {item.title ?? "Item"}
                    </Text>
                  ))}
                  {(fulfillment.labels ?? []).map((label) => (
                    <Text key={label.tracking_number} size="small">
                      Tracking:{" "}
                      {label.tracking_url ? (
                        <a href={label.tracking_url} target="_blank" rel="noreferrer" className="text-ui-fg-interactive">
                          {label.tracking_number}
                        </a>
                      ) : (
                        label.tracking_number
                      )}
                    </Text>
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {!shared && (
          <div className="flex items-center gap-x-2 border-t pt-4">
            <Button size="small" variant="secondary" disabled={canceled} onClick={() => setAction("refund")}>
              Refund
            </Button>
            <Button size="small" variant="secondary" disabled={canceled} onClick={openReturn}>
              Record a return
            </Button>
            <Button size="small" variant="danger" disabled={canceled} onClick={confirmCancelOrder}>
              Cancel order
            </Button>
          </div>
        )}
      </Container>

      {/* Fulfil */}
      <Drawer open={action === "fulfil"} onOpenChange={(open) => !open && close()}>
        <Drawer.Content className="max-w-md">
          <Drawer.Header>
            <Drawer.Title>Fulfil items</Drawer.Title>
            <Drawer.Description className="text-ui-fg-subtle text-sm">
              Pack items from your own location. Stock goes down when you save.
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-4 p-6">
            {unfulfilled.map(({ item, left }) => (
              <div key={item.id} className="flex items-center justify-between gap-x-4">
                <Text size="small">
                  {item.title} <span className="text-ui-fg-muted">({left} left)</span>
                </Text>
                <Input
                  className="w-20"
                  type="number"
                  min="0"
                  max={left}
                  value={quantities[item.id] ?? "0"}
                  onChange={(event) => setQuantities({ ...quantities, [item.id]: event.target.value })}
                />
              </div>
            ))}
            {methods.length > 1 && (
              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">Shipping method</Label>
                <Select value={optionId} onValueChange={setOptionId}>
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {methods.map((method) => (
                      <Select.Item key={method.shipping_option_id as string} value={method.shipping_option_id as string}>
                        {method.name ?? method.shipping_option_id}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-x-2">
              <Checkbox checked={notify} onCheckedChange={(value) => setNotify(value === true)} id="notify-fulfil" />
              <Label htmlFor="notify-fulfil" size="small">Email the buyer</Label>
            </div>
          </Drawer.Body>
          <Drawer.Footer className="flex items-center justify-end gap-x-2 border-t p-6">
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button onClick={submitFulfil} isLoading={fulfilMutation.isPending}>Save</Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

      {/* Ship */}
      <Drawer open={action === "ship"} onOpenChange={(open) => !open && close()}>
        <Drawer.Content className="max-w-md">
          <Drawer.Header>
            <Drawer.Title>Mark as shipped</Drawer.Title>
            <Drawer.Description className="text-ui-fg-subtle text-sm">
              Add the tracking details so the buyer can follow the parcel.
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-4 p-6">
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">Tracking number</Label>
              <Input value={tracking} onChange={(event) => setTracking(event.target.value)} />
            </div>
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">Tracking link (optional)</Label>
              <Input value={trackingUrl} onChange={(event) => setTrackingUrl(event.target.value)} placeholder="https://" />
            </div>
            <div className="flex items-center gap-x-2">
              <Checkbox checked={notify} onCheckedChange={(value) => setNotify(value === true)} id="notify-ship" />
              <Label htmlFor="notify-ship" size="small">Email the buyer</Label>
            </div>
          </Drawer.Body>
          <Drawer.Footer className="flex items-center justify-end gap-x-2 border-t p-6">
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button onClick={() => shipMutation.mutate()} isLoading={shipMutation.isPending}>Mark shipped</Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

      {/* Refund */}
      <Drawer open={action === "refund"} onOpenChange={(open) => !open && close()}>
        <Drawer.Content className="max-w-md">
          <Drawer.Header>
            <Drawer.Title>Refund the buyer</Drawer.Title>
            <Drawer.Description className="text-ui-fg-subtle text-sm">
              You can refund up to what this order is worth. The money is returned to the buyer&apos;s payment.
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-4 p-6">
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">Amount ({(order.currency_code ?? "").toUpperCase()})</Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </div>
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">Note (optional)</Label>
              <Input value={note} onChange={(event) => setNote(event.target.value)} />
            </div>
          </Drawer.Body>
          <Drawer.Footer className="flex items-center justify-end gap-x-2 border-t p-6">
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button onClick={submitRefund} isLoading={refundMutation.isPending}>Refund</Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

      {/* Return */}
      <Drawer open={action === "return"} onOpenChange={(open) => !open && close()}>
        <Drawer.Content className="max-w-md">
          <Drawer.Header>
            <Drawer.Title>Record a return</Drawer.Title>
            <Drawer.Description className="text-ui-fg-subtle text-sm">
              Choose the items coming back. Refund the buyer separately.
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-4 p-6">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-x-4">
                <Text size="small">{item.title}</Text>
                <Input
                  className="w-20"
                  type="number"
                  min="0"
                  max={num(item.quantity)}
                  value={quantities[item.id] ?? "0"}
                  onChange={(event) => setQuantities({ ...quantities, [item.id]: event.target.value })}
                />
              </div>
            ))}
            <div className="flex items-center gap-x-2">
              <Checkbox checked={received} onCheckedChange={(value) => setReceived(value === true)} id="received" />
              <Label htmlFor="received" size="small">Already received back (puts the stock back)</Label>
            </div>
            {received && (locations?.stock_locations?.length ?? 0) > 1 && (
              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">Received at</Label>
                <Select value={locationId || locations?.stock_locations?.[0]?.id} onValueChange={setLocationId}>
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {(locations?.stock_locations ?? []).map((location) => (
                      <Select.Item key={location.id} value={location.id}>{location.name}</Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">Note (optional)</Label>
              <Input value={note} onChange={(event) => setNote(event.target.value)} />
            </div>
          </Drawer.Body>
          <Drawer.Footer className="flex items-center justify-end gap-x-2 border-t p-6">
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button onClick={submitReturn} isLoading={returnMutation.isPending}>Record return</Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </>
  )
}
