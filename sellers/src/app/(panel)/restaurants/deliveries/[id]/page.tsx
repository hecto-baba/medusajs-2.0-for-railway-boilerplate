"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Label,
  Select,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import {
  ArrowLeft,
  ChefHat,
  FlyingBox,
  MapPin,
  Phone,
  User,
  CheckCircle,
  Clock,
} from "@medusajs/icons"
import Link from "next/link"
import {
  getVendorDelivery,
  updateVendorDelivery,
  listVendorDrivers,
  VendorDeliveryStatus,
} from "@lib/data/vendor-client"

const STATUS_STEPS = [
  { key: VendorDeliveryStatus.PENDING, label: "Pending" },
  { key: VendorDeliveryStatus.RESTAURANT_ACCEPTED, label: "Accepted" },
  { key: VendorDeliveryStatus.RESTAURANT_PREPARING, label: "Preparing" },
  { key: VendorDeliveryStatus.READY_FOR_PICKUP, label: "Ready" },
  { key: VendorDeliveryStatus.IN_TRANSIT, label: "In Transit" },
  { key: VendorDeliveryStatus.DELIVERED, label: "Delivered" },
]

export default function DeliveryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [selectedDriverId, setSelectedDriverId] = useState<string>("")
  const [etaInput, setEtaInput] = useState<string>("")

  // Fetch Delivery Details
  const { data, isLoading } = useQuery({
    queryKey: ["vendor-delivery", id],
    queryFn: () => getVendorDelivery(id),
    enabled: !!id,
    refetchInterval: 8000,
  })

  // Fetch Drivers
  const { data: driversData } = useQuery({
    queryKey: ["vendor-drivers"],
    queryFn: () => listVendorDrivers(),
  })

  const delivery = data?.delivery
  const drivers = driversData?.drivers || []
  const order = delivery?.order
  const driver = delivery?.driver

  const updateMutation = useMutation({
    mutationFn: (payload: {
      status?: string
      driver_id?: string | null
      eta?: string | null
    }) =>
      updateVendorDelivery(id, {
        delivery_status: payload.status,
        driver_id: payload.driver_id,
        eta: payload.eta,
      }),
    onSuccess: () => {
      toast.success("Updated", { description: "Delivery status updated successfully" })
      queryClient.invalidateQueries({ queryKey: ["vendor-delivery", id] })
      queryClient.invalidateQueries({ queryKey: ["vendor-deliveries"] })
    },
    onError: (err: any) => {
      toast.error("Error", { description: err.message || "Failed to update delivery" })
    },
  })

  const currentStatus = delivery?.delivery_status || VendorDeliveryStatus.PENDING

  const getStepIndex = (status: string) => {
    switch (status) {
      case VendorDeliveryStatus.PENDING:
        return 0
      case VendorDeliveryStatus.RESTAURANT_ACCEPTED:
        return 1
      case VendorDeliveryStatus.RESTAURANT_PREPARING:
        return 2
      case VendorDeliveryStatus.READY_FOR_PICKUP:
        return 3
      case VendorDeliveryStatus.PICKUP_CLAIMED:
      case VendorDeliveryStatus.IN_TRANSIT:
        return 4
      case VendorDeliveryStatus.DELIVERED:
        return 5
      default:
        return 0
    }
  }

  const activeStepIdx = getStepIndex(currentStatus)

  if (isLoading || !delivery) {
    return <div className="p-8 text-center text-ui-fg-subtle">Loading delivery details...</div>
  }

  return (
    <div className="flex flex-col gap-y-6 max-w-5xl mx-auto p-4 md:p-8">
      {/* Navigation */}
      <div>
        <Link
          href="/restaurants/deliveries"
          className="text-xs font-semibold text-ui-fg-subtle hover:text-ui-fg-base flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Live Deliveries
        </Link>
        <div className="flex items-center justify-between mt-2">
          <Heading level="h1" className="text-2xl font-bold flex items-center gap-2">
            <FlyingBox className="w-6 h-6 text-orange-500" />
            Delivery Details: {order?.display_id ? `Order #${order.display_id}` : delivery.id}
          </Heading>
          <Badge
            color={currentStatus === VendorDeliveryStatus.DELIVERED ? "green" : "orange"}
            size="small"
          >
            {currentStatus.replace(/_/g, " ").toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Visual Timeline Stepper */}
      <Container className="p-6">
        <Text size="xsmall" className="text-ui-fg-subtle uppercase font-semibold mb-4">
          Kitchen Order Pipeline
        </Text>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          {STATUS_STEPS.map((step, idx) => {
            const isCompleted = idx <= activeStepIdx
            const isCurrent = idx === activeStepIdx

            return (
              <div
                key={step.key}
                className={`p-3 rounded-lg border text-center transition-all ${
                  isCurrent
                    ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-600 font-semibold"
                    : isCompleted
                    ? "border-emerald-500/50 bg-emerald-50/40 dark:bg-emerald-950/10 text-emerald-600"
                    : "border-ui-border-base bg-ui-bg-subtle text-ui-fg-subtle"
                }`}
              >
                <div className="text-xs font-mono">{idx + 1}.</div>
                <div className="text-xs mt-1">{step.label}</div>
              </div>
            )
          })}
        </div>

        {/* Quick Transition Buttons */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-ui-border-base">
          {currentStatus === VendorDeliveryStatus.PENDING && (
            <Button
              size="small"
              variant="primary"
              onClick={() => updateMutation.mutate({ status: VendorDeliveryStatus.RESTAURANT_ACCEPTED })}
            >
              Accept Order
            </Button>
          )}
          {currentStatus === VendorDeliveryStatus.RESTAURANT_ACCEPTED && (
            <Button
              size="small"
              variant="primary"
              onClick={() => updateMutation.mutate({ status: VendorDeliveryStatus.RESTAURANT_PREPARING })}
            >
              Start Preparing
            </Button>
          )}
          {currentStatus === VendorDeliveryStatus.RESTAURANT_PREPARING && (
            <Button
              size="small"
              variant="primary"
              onClick={() => updateMutation.mutate({ status: VendorDeliveryStatus.READY_FOR_PICKUP })}
            >
              Mark Ready for Pickup
            </Button>
          )}
          {currentStatus === VendorDeliveryStatus.READY_FOR_PICKUP && (
            <Button
              size="small"
              variant="primary"
              onClick={() => updateMutation.mutate({ status: VendorDeliveryStatus.IN_TRANSIT })}
            >
              Dispatch with Courier
            </Button>
          )}
          {currentStatus === VendorDeliveryStatus.IN_TRANSIT && (
            <Button
              size="small"
              variant="secondary"
              className="text-emerald-600 font-semibold"
              onClick={() => updateMutation.mutate({ status: VendorDeliveryStatus.DELIVERED })}
            >
              ✓ Complete Delivery
            </Button>
          )}
        </div>
      </Container>

      {/* Grid: Order Items & Delivery Address */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Order Items */}
        <Container className="p-5">
          <Heading level="h3" className="text-base font-semibold mb-3">
            Ordered Dishes & Items
          </Heading>
          {!order?.items || order.items.length === 0 ? (
            <Text size="small" className="text-ui-fg-subtle">
              No items recorded on this order.
            </Text>
          ) : (
            <div className="divide-y divide-ui-border-base">
              {order.items.map((it: any) => (
                <div key={it.id} className="py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-semibold text-ui-fg-base">{it.quantity}x</span>{" "}
                    <span className="text-ui-fg-base">{it.title}</span>
                  </div>
                  <div className="font-mono text-xs text-ui-fg-subtle">
                    {it.unit_price ? `${it.unit_price * (it.quantity || 1)} ${order.currency_code?.toUpperCase()}` : "-"}
                  </div>
                </div>
              ))}
              <div className="pt-3 flex items-center justify-between font-bold text-sm text-ui-fg-base">
                <span>Total Amount:</span>
                <span className="font-mono">{order.total ? `${order.total} ${order.currency_code?.toUpperCase()}` : "-"}</span>
              </div>
            </div>
          )}
        </Container>

        {/* Delivery Courier & Customer Destination */}
        <Container className="p-5 flex flex-col justify-between gap-y-4">
          <div>
            <Heading level="h3" className="text-base font-semibold mb-3">
              Delivery Destination & Courier
            </Heading>

            <div className="flex flex-col gap-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-ui-fg-subtle mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-xs text-ui-fg-subtle uppercase">
                    Customer Address
                  </div>
                  <div className="text-ui-fg-base mt-0.5">
                    {order?.shipping_address?.address_1 || "Delivery address specified at checkout"}
                    {order?.shipping_address?.city ? `, ${order.shipping_address.city}` : ""}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 pt-2 border-t border-ui-border-base">
                <User className="w-4 h-4 text-ui-fg-subtle mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-xs text-ui-fg-subtle uppercase">
                    Assigned Courier Driver
                  </div>
                  <div className="text-ui-fg-base mt-0.5">
                    {driver ? (
                      <span className="font-medium">
                        {driver.first_name} {driver.last_name} {driver.phone ? `(${driver.phone})` : ""}
                      </span>
                    ) : (
                      <span className="text-ui-fg-muted italic">No driver assigned yet</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 pt-2 border-t border-ui-border-base">
                <Clock className="w-4 h-4 text-ui-fg-subtle mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-xs text-ui-fg-subtle uppercase">
                    Estimated Arrival (ETA)
                  </div>
                  <div className="text-ui-fg-base mt-0.5 font-mono">
                    {delivery.eta ? new Date(delivery.eta).toLocaleString() : "Not specified"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Assign Driver Form */}
          <div className="pt-3 border-t border-ui-border-base">
            <Label className="text-xs font-semibold">Assign Driver</Label>
            <div className="flex items-center gap-2 mt-1.5">
              <Select
                value={selectedDriverId || driver?.id || ""}
                onValueChange={setSelectedDriverId}
              >
                <Select.Trigger className="w-full text-xs">
                  <Select.Value placeholder="Select Courier Driver" />
                </Select.Trigger>
                <Select.Content>
                  {drivers.map((d) => (
                    <Select.Item key={d.id} value={d.id}>
                      {d.first_name} {d.last_name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
              <Button
                size="small"
                variant="secondary"
                disabled={!selectedDriverId || updateMutation.isPending}
                onClick={() => updateMutation.mutate({ driver_id: selectedDriverId })}
              >
                Assign
              </Button>
            </div>
          </div>
        </Container>
      </div>
    </div>
  )
}
