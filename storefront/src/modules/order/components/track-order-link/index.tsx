import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"

/**
 * "Track your order" for a food order. The delivery id is noted on the order
 * when checkout creates the delivery, so any other kind of order renders nothing.
 */
export const getDeliveryId = (order: HttpTypes.StoreOrder): string | null => {
  const id = order.metadata?.delivery_id
  return typeof id === "string" && id ? id : null
}

const TrackOrderLink = ({ order }: { order: HttpTypes.StoreOrder }) => {
  const deliveryId = getDeliveryId(order)
  if (!deliveryId) return null

  return (
    <LocalizedClientLink
      href={`/deliveries/${deliveryId}`}
      className="inline-flex items-center justify-center rounded-large bg-brand px-5 py-2.5 text-sm font-extrabold text-white hover:opacity-90"
      data-testid="track-order-link"
    >
      Track your order
    </LocalizedClientLink>
  )
}

export default TrackOrderLink
