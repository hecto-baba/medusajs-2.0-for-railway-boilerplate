import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Select,
  StatusBadge,
  toast,
} from "@medusajs/ui"
import {
  ArrowLeft,
  BuildingStorefront,
  CheckCircle,
  Clock,
  FlyingBox,
  PencilSquare,
  TruckFast,
  User,
} from "@medusajs/icons"
import { sdk } from "../../../lib/sdk"
import { DeliveryStatus } from "../page"

type Driver = {
  id: string
  first_name: string
  last_name: string
  phone: string
  email: string
}

type Restaurant = {
  id: string
  name: string
  handle: string
  address?: string
  phone?: string
  email?: string
}

type Order = {
  id: string
  display_id?: number
  total?: number
  currency_code?: string
}

type DeliveryDetail = {
  id: string
  transaction_id?: string | null
  delivery_status: DeliveryStatus
  eta?: string | null
  delivered_at?: string | null
  driver?: Driver | null
  restaurant?: Restaurant | null
  order?: Order | null
}

type DeliveryResponse = {
  delivery: DeliveryDetail
}

type DriversResponse = {
  drivers: Driver[]
}

const STATUS_STEPS: { key: DeliveryStatus; label: string }[] = [
  { key: DeliveryStatus.PENDING, label: "Pending" },
  { key: DeliveryStatus.RESTAURANT_ACCEPTED, label: "Accepted" },
  { key: DeliveryStatus.RESTAURANT_PREPARING, label: "Preparing" },
  { key: DeliveryStatus.READY_FOR_PICKUP, label: "Ready" },
  { key: DeliveryStatus.IN_TRANSIT, label: "In Transit" },
  { key: DeliveryStatus.DELIVERED, label: "Delivered" },
]

function getStepIndex(status: DeliveryStatus): number {
  switch (status) {
    case DeliveryStatus.PENDING:
      return 0
    case DeliveryStatus.RESTAURANT_ACCEPTED:
      return 1
    case DeliveryStatus.RESTAURANT_PREPARING:
      return 2
    case DeliveryStatus.READY_FOR_PICKUP:
      return 3
    case DeliveryStatus.PICKUP_CLAIMED:
    case DeliveryStatus.IN_TRANSIT:
      return 4
    case DeliveryStatus.DELIVERED:
      return 5
    default:
      return -1
  }
}

const DeliveryDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [assignDriverOpen, setAssignDriverOpen] = useState(false)
  const [selectedDriverId, setSelectedDriverId] = useState<string>("")
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const [editStatus, setEditStatus] = useState<DeliveryStatus>(DeliveryStatus.PENDING)
  const [editEta, setEditEta] = useState<string>("")

  // Fetch Delivery Details
  const { data, isLoading } = useQuery<DeliveryResponse>({
    queryKey: ["deliveries", id],
    queryFn: async () => sdk.client.fetch(`/admin/deliveries/${id}`),
    enabled: !!id,
  })

  // Fetch Drivers for Assignment
  const { data: driversData } = useQuery<DriversResponse>({
    queryKey: ["admin-drivers"],
    queryFn: async () => sdk.client.fetch("/admin/drivers"),
  })

  const delivery = data?.delivery

  // Mutation to update delivery
  const updateDeliveryMutation = useMutation({
    mutationFn: async (payload: {
      delivery_status?: DeliveryStatus
      driver_id?: string | null
      eta?: string | null
      delivered_at?: string | null
    }) => {
      return sdk.client.fetch(`/admin/deliveries/${id}`, {
        method: "POST",
        body: payload,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries", id] })
      queryClient.invalidateQueries({ queryKey: ["deliveries"] })
      toast.success("Success", { description: "Delivery updated successfully" })
      setAssignDriverOpen(false)
      setEditDrawerOpen(false)
    },
    onError: (err: any) => {
      toast.error("Error", {
        description: err.message || "Failed to update delivery",
      })
    },
  })

  const handleStatusTransition = (nextStatus: DeliveryStatus) => {
    const payload: any = { delivery_status: nextStatus }
    if (nextStatus === DeliveryStatus.RESTAURANT_ACCEPTED && !delivery?.eta) {
      // default ETA: 35 minutes from now
      payload.eta = new Date(Date.now() + 35 * 60 * 1000).toISOString()
    }
    updateDeliveryMutation.mutate(payload)
  }

  const handleAssignDriver = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDriverId) return

    updateDeliveryMutation.mutate({
      driver_id: selectedDriverId,
      delivery_status:
        delivery?.delivery_status === DeliveryStatus.READY_FOR_PICKUP
          ? DeliveryStatus.PICKUP_CLAIMED
          : delivery?.delivery_status,
    })
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateDeliveryMutation.mutate({
      delivery_status: editStatus,
      eta: editEta ? new Date(editEta).toISOString() : undefined,
    })
  }

  const currentStep = delivery ? getStepIndex(delivery.delivery_status) : 0
  const isDeclined = delivery?.delivery_status === DeliveryStatus.RESTAURANT_DECLINED

  return (
    <div className="flex flex-col gap-y-6 pb-12">
      {/* Top Bar with Back Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="small"
            onClick={() => navigate("/deliveries")}
          >
            <ArrowLeft className="mr-1 inline-block h-4 w-4" /> Back to Deliveries
          </Button>
          <div className="flex items-center gap-2">
            <Heading level="h1">
              Delivery #{delivery?.id ? delivery.id.slice(-8) : "..."}
            </Heading>
            {delivery && (
              <Badge
                color={
                  delivery.delivery_status === DeliveryStatus.DELIVERED
                    ? "green"
                    : delivery.delivery_status === DeliveryStatus.RESTAURANT_DECLINED
                    ? "red"
                    : delivery.delivery_status === DeliveryStatus.IN_TRANSIT ||
                      delivery.delivery_status === DeliveryStatus.PICKUP_CLAIMED
                    ? "blue"
                    : "orange"
                }
                size="small"
              >
                {delivery.delivery_status.replace(/_/g, " ")}
              </Badge>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <Drawer open={editDrawerOpen} onOpenChange={setEditDrawerOpen}>
            <Drawer.Trigger asChild>
              <Button
                variant="secondary"
                size="small"
                onClick={() => {
                  if (delivery) {
                    setEditStatus(delivery.delivery_status)
                    setEditEta(
                      delivery.eta
                        ? new Date(delivery.eta).toISOString().slice(0, 16)
                        : ""
                    )
                  }
                  setEditDrawerOpen(true)
                }}
              >
                <PencilSquare className="mr-1 inline-block h-4 w-4" /> Edit Delivery
              </Button>
            </Drawer.Trigger>
            <Drawer.Content>
              <Drawer.Header>
                <Drawer.Title>Edit Delivery</Drawer.Title>
              </Drawer.Header>
              <form onSubmit={handleEditSubmit} className="flex flex-col gap-4 p-4">
                <div>
                  <Label>Status</Label>
                  <Select
                    value={editStatus}
                    onValueChange={(val) => setEditStatus(val as DeliveryStatus)}
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Select status" />
                    </Select.Trigger>
                    <Select.Content>
                      {Object.values(DeliveryStatus).map((st) => (
                        <Select.Item key={st} value={st}>
                          {st.replace(/_/g, " ")}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>
                <div>
                  <Label>Estimated Time of Arrival (ETA)</Label>
                  <Input
                    type="datetime-local"
                    value={editEta}
                    onChange={(e) => setEditEta(e.target.value)}
                  />
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setEditDrawerOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    isLoading={updateDeliveryMutation.isPending}
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </Drawer.Content>
          </Drawer>

          {/* Contextual Action Button */}
          {delivery && (
            <>
              {delivery.delivery_status === DeliveryStatus.PENDING && (
                <>
                  <Button
                    size="small"
                    variant="danger"
                    isLoading={updateDeliveryMutation.isPending}
                    onClick={() =>
                      handleStatusTransition(DeliveryStatus.RESTAURANT_DECLINED)
                    }
                  >
                    Decline
                  </Button>
                  <Button
                    size="small"
                    isLoading={updateDeliveryMutation.isPending}
                    onClick={() =>
                      handleStatusTransition(DeliveryStatus.RESTAURANT_ACCEPTED)
                    }
                  >
                    Accept Order
                  </Button>
                </>
              )}

              {delivery.delivery_status === DeliveryStatus.RESTAURANT_ACCEPTED && (
                <Button
                  size="small"
                  isLoading={updateDeliveryMutation.isPending}
                  onClick={() =>
                    handleStatusTransition(DeliveryStatus.RESTAURANT_PREPARING)
                  }
                >
                  Start Preparing
                </Button>
              )}

              {delivery.delivery_status === DeliveryStatus.RESTAURANT_PREPARING && (
                <Button
                  size="small"
                  isLoading={updateDeliveryMutation.isPending}
                  onClick={() =>
                    handleStatusTransition(DeliveryStatus.READY_FOR_PICKUP)
                  }
                >
                  Ready for Pickup
                </Button>
              )}

              {delivery.delivery_status === DeliveryStatus.READY_FOR_PICKUP && (
                <Button
                  size="small"
                  onClick={() => setAssignDriverOpen(true)}
                >
                  <TruckFast className="mr-1 inline-block h-4 w-4" /> Assign Driver
                </Button>
              )}

              {delivery.delivery_status === DeliveryStatus.PICKUP_CLAIMED && (
                <Button
                  size="small"
                  isLoading={updateDeliveryMutation.isPending}
                  onClick={() =>
                    handleStatusTransition(DeliveryStatus.IN_TRANSIT)
                  }
                >
                  Mark Picked Up (In Transit)
                </Button>
              )}

              {delivery.delivery_status === DeliveryStatus.IN_TRANSIT && (
                <Button
                  size="small"
                  isLoading={updateDeliveryMutation.isPending}
                  onClick={() =>
                    handleStatusTransition(DeliveryStatus.DELIVERED)
                  }
                >
                  <CheckCircle className="mr-1 inline-block h-4 w-4" /> Mark Delivered
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {isLoading && (
        <Container>
          <div className="py-8 text-center text-ui-fg-subtle">
            Loading delivery details...
          </div>
        </Container>
      )}

      {delivery && (
        <>
          {/* Visual Progress Stepper */}
          <Container className="p-6">
            <Heading level="h2" className="mb-4 text-base">
              Delivery Progress
            </Heading>
            {isDeclined ? (
              <div className="rounded-lg bg-ui-bg-subtle border border-ui-border-danger p-4 text-ui-fg-danger">
                This delivery was declined by the restaurant.
              </div>
            ) : (
              <div className="flex w-full items-center justify-between">
                {STATUS_STEPS.map((step, idx) => {
                  const isCompleted = currentStep > idx
                  const isCurrent = currentStep === idx
                  return (
                    <div
                      key={step.key}
                      className="flex flex-1 flex-col items-center relative"
                    >
                      {/* Connecting Line */}
                      {idx !== 0 && (
                        <div
                          className={`absolute top-4 -left-1/2 w-full h-1 ${
                            currentStep >= idx
                              ? "bg-ui-bg-interactive"
                              : "bg-ui-border-base"
                          }`}
                          style={{ zIndex: 0 }}
                        />
                      )}

                      {/* Step Circle */}
                      <div
                        className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                          isCompleted
                            ? "bg-ui-bg-interactive text-white"
                            : isCurrent
                            ? "border-2 border-ui-border-interactive bg-ui-bg-base text-ui-fg-interactive"
                            : "border border-ui-border-base bg-ui-bg-subtle text-ui-fg-muted"
                        }`}
                      >
                        {isCompleted ? "✓" : idx + 1}
                      </div>
                      <span
                        className={`mt-2 text-xs text-center font-medium ${
                          isCurrent
                            ? "text-ui-fg-base"
                            : "text-ui-fg-muted"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </Container>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Delivery Details Card */}
            <Container className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <FlyingBox className="h-5 w-5 text-ui-fg-subtle" />
                <Heading level="h2" className="text-base">
                  Delivery Details
                </Heading>
              </div>
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-ui-fg-muted">Delivery ID:</span>
                  <span className="font-mono text-xs">{delivery.id}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-ui-fg-muted">Transaction ID:</span>
                  <span className="font-mono text-xs">
                    {delivery.transaction_id || "None"}
                  </span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-ui-fg-muted">Status:</span>
                  <StatusBadge
                    color={
                      delivery.delivery_status === DeliveryStatus.DELIVERED
                        ? "green"
                        : delivery.delivery_status === DeliveryStatus.RESTAURANT_DECLINED
                        ? "red"
                        : "orange"
                    }
                  >
                    {delivery.delivery_status.replace(/_/g, " ")}
                  </StatusBadge>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-ui-fg-muted">Estimated Arrival (ETA):</span>
                  <span>
                    {delivery.eta ? new Date(delivery.eta).toLocaleString() : "Not set"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ui-fg-muted">Delivered At:</span>
                  <span>
                    {delivery.delivered_at
                      ? new Date(delivery.delivered_at).toLocaleString()
                      : "Pending delivery"}
                  </span>
                </div>
              </div>
            </Container>

            {/* Assigned Driver Card */}
            <Container className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TruckFast className="h-5 w-5 text-ui-fg-subtle" />
                  <Heading level="h2" className="text-base">
                    Assigned Driver
                  </Heading>
                </div>
                <Drawer
                  open={assignDriverOpen}
                  onOpenChange={setAssignDriverOpen}
                >
                  <Drawer.Trigger asChild>
                    <Button variant="secondary" size="small">
                      {delivery.driver ? "Change Driver" : "Assign Driver"}
                    </Button>
                  </Drawer.Trigger>
                  <Drawer.Content>
                    <Drawer.Header>
                      <Drawer.Title>
                        {delivery.driver ? "Change Assigned Driver" : "Assign Driver"}
                      </Drawer.Title>
                    </Drawer.Header>
                    <form
                      onSubmit={handleAssignDriver}
                      className="flex flex-col gap-4 p-4"
                    >
                      <div>
                        <Label>Select Driver</Label>
                        <Select
                          value={selectedDriverId}
                          onValueChange={setSelectedDriverId}
                        >
                          <Select.Trigger>
                            <Select.Value placeholder="Select a driver..." />
                          </Select.Trigger>
                          <Select.Content>
                            {(driversData?.drivers || []).map((driver) => (
                              <Select.Item key={driver.id} value={driver.id}>
                                {driver.first_name} {driver.last_name} ({driver.phone})
                              </Select.Item>
                            ))}
                          </Select.Content>
                        </Select>
                      </div>
                      <div className="mt-4 flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          type="button"
                          onClick={() => setAssignDriverOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          isLoading={updateDeliveryMutation.isPending}
                          disabled={!selectedDriverId}
                        >
                          Confirm Assignment
                        </Button>
                      </div>
                    </form>
                  </Drawer.Content>
                </Drawer>
              </div>

              {delivery.driver ? (
                <div className="flex flex-col gap-3 text-sm">
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-ui-fg-muted">Driver Name:</span>
                    <span className="font-medium">
                      {delivery.driver.first_name} {delivery.driver.last_name}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-ui-fg-muted">Phone:</span>
                    <span>{delivery.driver.phone || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ui-fg-muted">Email:</span>
                    <span>{delivery.driver.email || "N/A"}</span>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-ui-fg-muted text-sm">
                  <User className="mx-auto h-8 w-8 text-ui-fg-subtle mb-2" />
                  <p>No driver has been assigned to this delivery yet.</p>
                </div>
              )}
            </Container>

            {/* Restaurant Information Card (if linked) */}
            {delivery.restaurant && (
              <Container className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BuildingStorefront className="h-5 w-5 text-ui-fg-subtle" />
                    <Heading level="h2" className="text-base">
                      Restaurant
                    </Heading>
                  </div>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() =>
                      navigate(`/restaurants/${delivery.restaurant?.id}`)
                    }
                  >
                    View Restaurant
                  </Button>
                </div>
                <div className="flex flex-col gap-3 text-sm">
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-ui-fg-muted">Restaurant Name:</span>
                    <span className="font-medium">
                      {delivery.restaurant.name}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-ui-fg-muted">Address:</span>
                    <span>{delivery.restaurant.address || "N/A"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-ui-fg-muted">Phone:</span>
                    <span>{delivery.restaurant.phone || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ui-fg-muted">Email:</span>
                    <span>{delivery.restaurant.email || "N/A"}</span>
                  </div>
                </div>
              </Container>
            )}

            {/* Order Information Card (if linked) */}
            {delivery.order && (
              <Container className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-ui-fg-subtle" />
                    <Heading level="h2" className="text-base">
                      Associated Order
                    </Heading>
                  </div>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => navigate(`/orders/${delivery.order?.id}`)}
                  >
                    View Order
                  </Button>
                </div>
                <div className="flex flex-col gap-3 text-sm">
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-ui-fg-muted">Order ID:</span>
                    <span className="font-mono text-xs">{delivery.order.id}</span>
                  </div>
                  {delivery.order.display_id && (
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-ui-fg-muted">Display ID:</span>
                      <span>#{delivery.order.display_id}</span>
                    </div>
                  )}
                  {delivery.order.total !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-ui-fg-muted">Total:</span>
                      <span className="font-medium">
                        {(delivery.order.total / 100).toFixed(2)}{" "}
                        {delivery.order.currency_code?.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              </Container>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default DeliveryDetailPage
