import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import { Text } from "@medusajs/ui"

type ShippingDetailsProps = {
  order: HttpTypes.StoreOrder
}

const ShippingDetails = ({ order }: ShippingDetailsProps) => {
  // A ticket order is delivered by email and carries no shipping method at
  // all, so there is no delivery to describe. Rendering the section anyway
  // crashed the confirmation page: the method block below indexed
  // shipping_methods[0] unguarded, and reading .total off an empty array threw
  // before the order could be shown.
  const shippingMethod = order.shipping_methods?.[0]

  if (!shippingMethod) {
    return null
  }

  return (
    <div className="rounded-large bg-card p-5 shadow-lift">
      <h2 className="font-display text-xl font-extrabold tracking-tight mb-4">
        Delivery
      </h2>
      <div className="grid grid-cols-1 gap-4 small:grid-cols-3 small:gap-x-8">
        <div
          className="flex flex-col"
          data-testid="shipping-address-summary"
        >
          <Text className="text-xs font-bold uppercase tracking-wider text-muted mb-1">
            Shipping Address
          </Text>
          <Text className="text-ink">
            {order.shipping_address?.first_name}{" "}
            {order.shipping_address?.last_name}
          </Text>
          {order.shipping_address?.company && (
            <Text className="text-ink">
              {order.shipping_address.company}
            </Text>
          )}
          <Text className="text-ink">
            {order.shipping_address?.address_1}{" "}
            {order.shipping_address?.address_2}
          </Text>
          <Text className="text-ink">
            {order.shipping_address?.postal_code},{" "}
            {order.shipping_address?.city}
            {order.shipping_address?.province ? `, ${order.shipping_address.province}` : ""}
          </Text>
          <Text className="text-ink">
            {order.shipping_address?.country_code?.toUpperCase()}
          </Text>
        </div>

        <div
          className="flex flex-col"
          data-testid="shipping-contact-summary"
        >
          <Text className="text-xs font-bold uppercase tracking-wider text-muted mb-1">Contact</Text>
          <Text className="text-ink">
            {order.shipping_address?.phone}
          </Text>
          <Text className="text-ink">{order.email}</Text>
        </div>

        <div
          className="flex flex-col"
          data-testid="shipping-method-summary"
        >
          <Text className="text-xs font-bold uppercase tracking-wider text-muted mb-1">Method</Text>
          <Text className="text-ink">
            {shippingMethod.name} (
            {convertToLocale({
              amount: shippingMethod.total ?? 0,
              currency_code: order.currency_code,
            })
              .replace(/,/g, "")
              .replace(/\./g, ",")}
            )
          </Text>
        </div>
      </div>
    </div>
  )
}

export default ShippingDetails
