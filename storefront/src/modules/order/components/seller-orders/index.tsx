import { Heading, Text } from "@medusajs/ui"

import type { SellerOrder } from "@lib/data/orders"
import { convertToLocale } from "@lib/util/money"

const STATUS_LABEL: Record<SellerOrder["fulfillment_status"], string> = {
  not_fulfilled: "Being prepared",
  fulfilled: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
}

type SellerOrdersProps = {
  sellerOrders: SellerOrder[]
}

// Shown only when an order holds several sellers' items: one block per seller
// with what they are sending and where it stands.
const SellerOrders = ({ sellerOrders }: SellerOrdersProps) => {
  if (!sellerOrders.length) {
    return null
  }

  return (
    <div data-testid="seller-orders">
      <Heading level="h2" className="flex flex-row text-3xl-regular my-6">
        Shipped by
      </Heading>
      <div className="flex flex-col gap-y-4">
        {sellerOrders.map((sellerOrder) => (
          <div
            key={sellerOrder.id}
            className="border border-ui-border-base rounded-rounded p-4"
            data-testid="seller-order"
          >
            <div className="flex items-center justify-between mb-2">
              <Text className="txt-medium-plus text-ui-fg-base">
                {sellerOrder.seller.name ?? "Seller"}
              </Text>
              <Text className="txt-medium text-ui-fg-subtle" data-testid="seller-order-status">
                {STATUS_LABEL[sellerOrder.fulfillment_status]}
              </Text>
            </div>
            <ul className="flex flex-col gap-y-1">
              {sellerOrder.items.map((item, index) => (
                <li key={`${item.title}-${index}`} className="txt-medium text-ui-fg-subtle">
                  {item.quantity} x {item.title}
                </li>
              ))}
            </ul>
            <Text className="txt-medium text-ui-fg-subtle mt-2">
              {convertToLocale({
                amount: sellerOrder.total,
                currency_code: sellerOrder.currency_code,
              })}
            </Text>
          </div>
        ))}
      </div>
    </div>
  )
}

export default SellerOrders
