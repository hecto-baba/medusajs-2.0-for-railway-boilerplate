import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"

import Chip from "@modules/common/components/chip"

type OrderDetailsProps = {
  order: HttpTypes.StoreOrder
  showStatus?: boolean
  centered?: boolean
}

const OrderDetails = ({ order, showStatus, centered }: OrderDetailsProps) => {
  const fulfillmentStatus = (order as any).fulfillment_status || "not_fulfilled"
  const paymentStatus = (order as any).payment_status || "not_paid"

  const getFulfillmentBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "delivered":
        return <Chip tone="success">Delivered to Destination</Chip>
      case "shipped":
      case "partially_shipped":
        return <Chip tone="pop">In Transit / Shipped</Chip>
      case "fulfilled":
      case "partially_fulfilled":
        return <Chip tone="pop">Packed & Ready</Chip>
      default:
        return <Chip tone="muted">Order Confirmed &bull; Preparing</Chip>
    }
  }

  const getPaymentBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "captured":
      case "paid":
        return <Chip tone="success">Paid (Captured)</Chip>
      case "authorized":
      case "partially_authorized":
        return <Chip tone="muted">Payment Authorized</Chip>
      case "refunded":
      case "partially_refunded":
        return <Chip tone="warning">Refunded</Chip>
      default:
        return <Chip tone="warning">Payment Awaiting</Chip>
    }
  }

  return (
    <div
      className={clx("flex flex-col gap-3", {
        "items-center text-center mt-5": centered,
      })}
    >
      <p className="text-muted">
        We have sent the order confirmation details to{" "}
        <span className="font-bold text-ink" data-testid="order-email">
          {order.email}
        </span>
        .
      </p>
      <div
        className={clx(
          "flex flex-wrap items-center gap-x-6 gap-y-2 text-sm",
          { "justify-center": centered }
        )}
      >
        <p>
          <span className="text-muted">Order date: </span>
          <span className="font-bold" data-testid="order-date">
            {new Date(order.created_at).toDateString()}
          </span>
        </p>
        <p className="font-bold text-brand">
          Order number: <span data-testid="order-id">#{order.display_id}</span>
        </p>
      </div>

      {showStatus && (
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted">Delivery:</span>
            {getFulfillmentBadge(fulfillmentStatus)}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted">Payment:</span>
            {getPaymentBadge(paymentStatus)}
          </div>
        </div>
      )}
    </div>
  )
}

export default OrderDetails
