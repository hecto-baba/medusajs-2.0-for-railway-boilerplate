"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Badge,
  Button,
  Container,
  Drawer,
  DropdownMenu,
  Heading,
  IconButton,
  Input,
  Label,
  Select,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import {
  ChefHat,
  FlyingBox,
  Clock,
  CheckCircle,
  TruckFast,
  User,
  Eye,
  EllipsisHorizontal,
} from "@medusajs/icons"
import Link from "next/link"
import {
  listVendorDeliveries,
  updateVendorDelivery,
  listVendorDrivers,
  VendorDelivery,
  VendorDeliveryStatus,
} from "@lib/data/vendor-client"

const STATUS_FILTERS = [
  { label: "All Deliveries", value: "" },
  { label: "Pending", value: VendorDeliveryStatus.PENDING },
  { label: "Accepted", value: VendorDeliveryStatus.RESTAURANT_ACCEPTED },
  { label: "Preparing", value: VendorDeliveryStatus.RESTAURANT_PREPARING },
  { label: "Ready for Pickup", value: VendorDeliveryStatus.READY_FOR_PICKUP },
  { label: "In Transit", value: VendorDeliveryStatus.IN_TRANSIT },
  { label: "Delivered", value: VendorDeliveryStatus.DELIVERED },
]

export default function RestaurantDeliveriesPage() {
  const queryClient = useQueryClient()
  const [selectedStatus, setSelectedStatus] = useState<string>("")
  const [assignDriverDelivery, setAssignDriverDelivery] = useState<VendorDelivery | null>(null)
  const [selectedDriverId, setSelectedDriverId] = useState<string>("")
  const [driverEta, setDriverEta] = useState<string>("")

  // Fetch Deliveries
  const { data, isLoading } = useQuery({
    queryKey: ["vendor-deliveries", selectedStatus],
    queryFn: () => listVendorDeliveries({ status: selectedStatus || undefined }),
    refetchInterval: 10000, // Live kitchen auto-refresh every 10s!
  })

  // Fetch Drivers
  const { data: driversData } = useQuery({
    queryKey: ["vendor-drivers"],
    queryFn: () => listVendorDrivers(),
  })

  const deliveries = data?.deliveries || []
  const drivers = driversData?.drivers || []

  // Update Delivery Mutation
  const updateDeliveryMutation = useMutation({
    mutationFn: ({
      id,
      status,
      driver_id,
      eta,
    }: {
      id: string
      status?: string
      driver_id?: string | null
      eta?: string | null
    }) =>
      updateVendorDelivery(id, {
        delivery_status: status,
        driver_id,
        eta,
      }),
    onSuccess: () => {
      toast.success("Success", { description: "Delivery updated" })
      setAssignDriverDelivery(null)
      queryClient.invalidateQueries({ queryKey: ["vendor-deliveries"] })
    },
    onError: (err: any) => {
      toast.error("Error", { description: err.message || "Failed to update delivery" })
    },
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case VendorDeliveryStatus.DELIVERED:
        return "green"
      case VendorDeliveryStatus.IN_TRANSIT:
      case VendorDeliveryStatus.PICKUP_CLAIMED:
        return "blue"
      case VendorDeliveryStatus.RESTAURANT_PREPARING:
      case VendorDeliveryStatus.READY_FOR_PICKUP:
      case VendorDeliveryStatus.RESTAURANT_ACCEPTED:
        return "orange"
      case VendorDeliveryStatus.RESTAURANT_DECLINED:
        return "red"
      default:
        return "grey"
    }
  }

  return (
    <div className="flex flex-col gap-y-6 max-w-7xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/restaurants"
              className="text-xs font-semibold text-ui-fg-subtle hover:text-ui-fg-base flex items-center gap-1"
            >
              &larr; Back to Restaurant Profile
            </Link>
          </div>
          <Heading level="h1" className="text-2xl font-bold flex items-center gap-2 mt-1">
            <FlyingBox className="w-6 h-6 text-orange-500" />
            Live Kitchen Deliveries
          </Heading>
          <Text size="small" className="text-ui-fg-subtle mt-0.5">
            Manage incoming food orders, kitchen preparation phases, driver dispatch, and customer delivery tracking.
          </Text>
        </div>

        {/* Live Refresh Indicator */}
        <div className="flex items-center gap-2 self-start md:self-auto bg-ui-bg-subtle px-3 py-1.5 rounded-full border border-ui-border-base text-xs font-medium text-ui-fg-subtle">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Live Kitchen Feed (10s)</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setSelectedStatus(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
              selectedStatus === tab.value
                ? "bg-ui-bg-subtle text-ui-fg-base border border-ui-border-base shadow-sm"
                : "text-ui-fg-subtle hover:text-ui-fg-base"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Deliveries Table */}
      <Container className="p-0 overflow-hidden divide-y divide-ui-border-base">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Delivery / Order</Table.HeaderCell>
              <Table.HeaderCell>Kitchen Status</Table.HeaderCell>
              <Table.HeaderCell>Assigned Driver</Table.HeaderCell>
              <Table.HeaderCell>ETA</Table.HeaderCell>
              <Table.HeaderCell>Actions</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Details</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {isLoading ? (
              <Table.Row>
                <td colSpan={6} className="text-center py-10 text-ui-fg-subtle">
                  Loading deliveries...
                </td>
              </Table.Row>
            ) : deliveries.length === 0 ? (
              <Table.Row>
                <td colSpan={6} className="text-center py-12">
                  <FlyingBox className="w-8 h-8 text-ui-fg-muted mx-auto mb-2 opacity-50" />
                  <Text className="font-medium text-ui-fg-base">No active deliveries</Text>
                  <Text size="small" className="text-ui-fg-subtle mt-1">
                    New delivery orders placed for your restaurant will appear here in real-time.
                  </Text>
                </td>
              </Table.Row>
            ) : (
              deliveries.map((delivery) => {
                const status = delivery.delivery_status as string
                const order = delivery.order

                return (
                  <Table.Row key={delivery.id} className="hover:bg-ui-bg-subtle/50 transition-colors">
                    <Table.Cell className="font-medium">
                      <div className="font-semibold text-ui-fg-base">
                        {order?.display_id ? `Order #${order.display_id}` : delivery.id.slice(0, 14)}
                      </div>
                      <div className="text-xs text-ui-fg-subtle mt-0.5">
                        {order?.items?.length || 1} {order?.items?.length === 1 ? "item" : "items"} ·{" "}
                        {order?.total ? `${order.total} ${order.currency_code?.toUpperCase()}` : "-"}
                      </div>
                    </Table.Cell>

                    <Table.Cell>
                      <Badge color={getStatusColor(status) as any} size="xsmall">
                        {status.replace(/_/g, " ").toUpperCase()}
                      </Badge>
                    </Table.Cell>

                    <Table.Cell>
                      {delivery.driver ? (
                        <div className="flex items-center gap-2 text-sm text-ui-fg-base">
                          <User className="w-4 h-4 text-ui-fg-subtle" />
                          <span>
                            {delivery.driver.first_name} {delivery.driver.last_name}
                          </span>
                        </div>
                      ) : (
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={() => {
                            setAssignDriverDelivery(delivery)
                            setSelectedDriverId(delivery.driver?.id || "")
                          }}
                          className="text-xs py-1"
                        >
                          + Assign Driver
                        </Button>
                      )}
                    </Table.Cell>

                    <Table.Cell className="text-xs text-ui-fg-subtle font-mono">
                      {delivery.eta ? new Date(delivery.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Not set"}
                    </Table.Cell>

                    {/* Step-by-Step Status Progression */}
                    <Table.Cell>
                      <div className="flex items-center gap-1.5">
                        {status === VendorDeliveryStatus.PENDING && (
                          <Button
                            size="small"
                            variant="primary"
                            onClick={() =>
                              updateDeliveryMutation.mutate({
                                id: delivery.id,
                                status: VendorDeliveryStatus.RESTAURANT_ACCEPTED,
                              })
                            }
                            className="text-xs py-1"
                          >
                            Accept Order
                          </Button>
                        )}

                        {status === VendorDeliveryStatus.RESTAURANT_ACCEPTED && (
                          <Button
                            size="small"
                            variant="primary"
                            onClick={() =>
                              updateDeliveryMutation.mutate({
                                id: delivery.id,
                                status: VendorDeliveryStatus.RESTAURANT_PREPARING,
                              })
                            }
                            className="text-xs py-1"
                          >
                            Start Preparing
                          </Button>
                        )}

                        {status === VendorDeliveryStatus.RESTAURANT_PREPARING && (
                          <Button
                            size="small"
                            variant="primary"
                            onClick={() =>
                              updateDeliveryMutation.mutate({
                                id: delivery.id,
                                status: VendorDeliveryStatus.READY_FOR_PICKUP,
                              })
                            }
                            className="text-xs py-1"
                          >
                            Ready for Pickup
                          </Button>
                        )}

                        {status === VendorDeliveryStatus.READY_FOR_PICKUP && (
                          <Button
                            size="small"
                            variant="primary"
                            onClick={() =>
                              updateDeliveryMutation.mutate({
                                id: delivery.id,
                                status: VendorDeliveryStatus.IN_TRANSIT,
                              })
                            }
                            className="text-xs py-1"
                          >
                            Dispatch / In Transit
                          </Button>
                        )}

                        {status === VendorDeliveryStatus.IN_TRANSIT && (
                          <Button
                            size="small"
                            variant="secondary"
                            onClick={() =>
                              updateDeliveryMutation.mutate({
                                id: delivery.id,
                                status: VendorDeliveryStatus.DELIVERED,
                              })
                            }
                            className="text-xs py-1 text-emerald-600"
                          >
                            Mark Delivered
                          </Button>
                        )}

                        {status === VendorDeliveryStatus.DELIVERED && (
                          <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Completed
                          </span>
                        )}
                      </div>
                    </Table.Cell>

                    <Table.Cell className="text-right">
                      <Link href={`/restaurants/deliveries/${delivery.id}`}>
                        <Button size="small" variant="transparent" className="text-xs">
                          View &rarr;
                        </Button>
                      </Link>
                    </Table.Cell>
                  </Table.Row>
                )
              })
            )}
          </Table.Body>
        </Table>
      </Container>

      {/* Assign Driver Drawer */}
      <Drawer
        open={!!assignDriverDelivery}
        onOpenChange={(open) => {
          if (!open) setAssignDriverDelivery(null)
        }}
      >
        <Drawer.Content className="max-w-md">
          <Drawer.Header>
            <Drawer.Title>Assign Delivery Driver</Drawer.Title>
            <Drawer.Description>
              Select a courier driver and set the delivery estimated arrival time.
            </Drawer.Description>
          </Drawer.Header>

          <div className="flex flex-col gap-y-4 p-6">
            <div>
              <Label className="text-xs font-semibold">Available Drivers</Label>
              <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                <Select.Trigger className="w-full mt-1.5">
                  <Select.Value placeholder="Select a courier driver" />
                </Select.Trigger>
                <Select.Content>
                  {drivers.map((d) => (
                    <Select.Item key={d.id} value={d.id}>
                      {d.first_name} {d.last_name} {d.phone ? `(${d.phone})` : ""}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Estimated Arrival (ETA)</Label>
              <Input
                type="datetime-local"
                value={driverEta}
                onChange={(e) => setDriverEta(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-ui-border-base">
              <Button
                size="small"
                variant="secondary"
                onClick={() => setAssignDriverDelivery(null)}
              >
                Cancel
              </Button>
              <Button
                size="small"
                variant="primary"
                disabled={!selectedDriverId || updateDeliveryMutation.isPending}
                isLoading={updateDeliveryMutation.isPending}
                onClick={() => {
                  if (assignDriverDelivery) {
                    updateDeliveryMutation.mutate({
                      id: assignDriverDelivery.id,
                      driver_id: selectedDriverId,
                      eta: driverEta ? new Date(driverEta).toISOString() : null,
                    })
                  }
                }}
              >
                Assign & Notify Driver
              </Button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer>
    </div>
  )
}
