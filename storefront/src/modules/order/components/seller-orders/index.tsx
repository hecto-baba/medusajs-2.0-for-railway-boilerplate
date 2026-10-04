import type { SellerOrder } from "@lib/data/orders"
import { convertToLocale } from "@lib/util/money"
import Chip from "@modules/common/components/chip"

const STATUS_LABEL: Record<SellerOrder["fulfillment_status"], string> = {
  not_fulfilled: "Being prepared",
  fulfilled: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
}

const STATUS_TONE: Record<
  SellerOrder["fulfillment_status"],
  "success" | "pop" | "muted"
> = {
  not_fulfilled: "muted",
  fulfilled: "pop",
  shipped: "pop",
  delivered: "success",
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
    <div
      className="rounded-large bg-card p-5 shadow-lift"
      data-testid="seller-orders"
    >
      <h2 className="font-display text-xl font-extrabold tracking-tight mb-4">
        Shipped by
      </h2>
      <div className="flex flex-col gap-y-3">
        {sellerOrders.map((sellerOrder) => (
          <div
            key={sellerOrder.id}
            className="rounded-[12px] border border-line bg-canvas p-4"
            data-testid="seller-order"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-bold text-ink">
                {sellerOrder.seller.name ?? "Seller"}
              </span>
              <span data-testid="seller-order-status">
                <Chip tone={STATUS_TONE[sellerOrder.fulfillment_status]}>
                  {STATUS_LABEL[sellerOrder.fulfillment_status]}
                </Chip>
              </span>
            </div>
            <ul className="flex flex-col gap-y-1">
              {sellerOrder.items.map((item, index) => (
                <li key={`${item.title}-${index}`} className="text-sm text-muted">
                  {item.quantity} x {item.title}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm font-bold">
              {convertToLocale({
                amount: sellerOrder.total,
                currency_code: sellerOrder.currency_code,
              })}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default SellerOrders
