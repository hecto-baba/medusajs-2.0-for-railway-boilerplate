import { HttpTypes } from "@medusajs/types"
import { Badge, Text } from "@medusajs/ui"

type OrderDetailsProps = {
  order: HttpTypes.StoreOrder
  showStatus?: boolean
}

const OrderDetails = ({ order, showStatus }: OrderDetailsProps) => {
  const fulfillmentStatus = (order as any).fulfillment_status || "not_fulfilled"
  const paymentStatus = (order as any).payment_status || "not_paid"

  const getFulfillmentBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "delivered":
        return (
          <Badge color="green" size="small" className="font-semibold gap-1">
            🚚 Delivered to Destination
          </Badge>
        )
      case "shipped":
      case "partially_shipped":
        return (
          <Badge color="blue" size="small" className="font-semibold gap-1">
            📦 In Transit / Shipped
          </Badge>
        )
      case "fulfilled":
      case "partially_fulfilled":
        return (
          <Badge color="purple" size="small" className="font-semibold gap-1">
            📦 Packed & Ready
          </Badge>
        )
      default:
        return (
          <Badge color="grey" size="small" className="font-semibold gap-1">
            🕒 Order Confirmed &bull; Preparing
          </Badge>
        )
    }
  }

  const getPaymentBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "captured":
      case "paid":
        return (
          <Badge color="green" size="small" className="font-semibold gap-1">
            💳 Paid (Captured)
          </Badge>
        )
      case "authorized":
      case "partially_authorized":
        return (
          <Badge color="blue" size="small" className="font-semibold gap-1">
            💳 Payment Authorized
          </Badge>
        )
      case "refunded":
      case "partially_refunded":
        return (
          <Badge color="red" size="small" className="font-semibold gap-1">
            ↩️ Refunded
          </Badge>
        )
      default:
        return (
          <Badge color="orange" size="small" className="font-semibold gap-1">
            ⏳ Payment Awaiting
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-4">
      <Text>
        We have sent the order confirmation details to{" "}
        <span
          className="text-ui-fg-medium-plus font-semibold"
          data-testid="order-email"
        >
          {order.email}
        </span>
        .
      </Text>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <Text>
          Order date:{" "}
          <span className="font-medium" data-testid="order-date">
            {new Date(order.created_at).toDateString()}
          </span>
        </Text>
        <Text className="text-ui-fg-interactive font-medium">
          Order number: <span data-testid="order-id">#{order.display_id}</span>
        </Text>
      </div>

      {showStatus && (
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-ui-fg-subtle">Delivery:</span>
            {getFulfillmentBadge(fulfillmentStatus)}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-ui-fg-subtle">Payment:</span>
            {getPaymentBadge(paymentStatus)}
          </div>
        </div>
      )}
    </div>
  )
}

export default OrderDetails
