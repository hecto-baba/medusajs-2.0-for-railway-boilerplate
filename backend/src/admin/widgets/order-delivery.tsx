import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { DetailWidgetProps, AdminOrder } from "@medusajs/framework/types"
import {
  Badge,
  Button,
  Container,
  Heading,
  StatusBadge,
} from "@medusajs/ui"
import {
  BuildingStorefront,
  FlyingBox,
  TruckFast,
} from "@medusajs/icons"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { sdk } from "../lib/sdk"

type Driver = {
  id: string
  first_name: string
  last_name: string
  phone?: string
}

type Restaurant = {
  id: string
  name: string
  address?: string
  phone?: string
}

type Delivery = {
  id: string
  delivery_status: string
  eta?: string | null
  delivered_at?: string | null
  driver?: Driver | null
  restaurant?: Restaurant | null
}

type OrderDeliveryResponse = {
  delivery: Delivery | null
}

const OrderDeliveryWidget = ({
  data: order,
}: DetailWidgetProps<AdminOrder>) => {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery<OrderDeliveryResponse>({
    queryKey: ["admin-order-delivery", order.id],
    queryFn: async () => sdk.client.fetch(`/admin/orders/${order.id}/delivery`),
  })

  const delivery = data?.delivery

  if (isLoading) {
    return (
      <Container className="p-6">
        <div className="text-ui-fg-subtle text-sm">
          Loading delivery tracking...
        </div>
      </Container>
    )
  }

  if (!delivery) {
    return null
  }

  return (
    <Container className="p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-2">
          <FlyingBox className="h-5 w-5 text-ui-fg-subtle" />
          <Heading level="h2" className="text-base">
            Restaurant Delivery Tracking
          </Heading>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            size="small"
            color={
              delivery.delivery_status === "delivered"
                ? "green"
                : delivery.delivery_status === "restaurant_declined"
                ? "red"
                : delivery.delivery_status === "in_transit" ||
                  delivery.delivery_status === "pickup_claimed"
                ? "blue"
                : "orange"
            }
          >
            {delivery.delivery_status.replace(/_/g, " ")}
          </Badge>
          <Button
            size="small"
            variant="secondary"
            onClick={() => navigate(`/deliveries/${delivery.id}`)}
          >
            View Delivery
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        {/* Restaurant summary */}
        {delivery.restaurant && (
          <div className="flex flex-col gap-1 rounded-lg border p-3">
            <div className="flex items-center gap-2 font-medium text-ui-fg-base mb-1">
              <BuildingStorefront className="h-4 w-4 text-ui-fg-subtle" />
              <span>{delivery.restaurant.name}</span>
            </div>
            <p className="text-ui-fg-muted text-xs">
              {delivery.restaurant.address || "Address not provided"}
            </p>
            {delivery.restaurant.phone && (
              <p className="text-ui-fg-muted text-xs">
                Phone: {delivery.restaurant.phone}
              </p>
            )}
          </div>
        )}

        {/* Driver & ETA summary */}
        <div className="flex flex-col gap-1 rounded-lg border p-3">
          <div className="flex items-center gap-2 font-medium text-ui-fg-base mb-1">
            <TruckFast className="h-4 w-4 text-ui-fg-subtle" />
            <span>
              {delivery.driver
                ? `Driver: ${delivery.driver.first_name} ${delivery.driver.last_name}`
                : "Driver: Unassigned"}
            </span>
          </div>
          {delivery.driver?.phone && (
            <p className="text-ui-fg-muted text-xs">
              Contact: {delivery.driver.phone}
            </p>
          )}
          <p className="text-ui-fg-muted text-xs">
            {delivery.delivered_at
              ? `Delivered: ${new Date(delivery.delivered_at).toLocaleString()}`
              : delivery.eta
              ? `ETA: ${new Date(delivery.eta).toLocaleString()}`
              : "ETA: Pending update"}
          </p>
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.after",
})

export default OrderDeliveryWidget
