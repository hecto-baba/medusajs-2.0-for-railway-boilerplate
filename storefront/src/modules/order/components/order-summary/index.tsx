import { HttpTypes } from "@medusajs/types"

import BillBreakdown, {
  BillLine,
} from "@modules/common/components/bill-breakdown"

type OrderSummaryProps = {
  order: HttpTypes.StoreOrder
}

const OrderSummary = ({ order }: OrderSummaryProps) => {
  const lines: BillLine[] = [
    { label: "Subtotal", amount: order.subtotal ?? 0 },
  ]

  if (order.discount_total > 0) {
    lines.push({
      label: "Discount",
      amount: -order.discount_total,
      tone: "success",
    })
  }

  if (order.gift_card_total > 0) {
    lines.push({
      label: "Gift card",
      amount: -order.gift_card_total,
      tone: "success",
    })
  }

  lines.push({ label: "Shipping", amount: order.shipping_total ?? 0 })
  lines.push({ label: "Taxes", amount: order.tax_total ?? 0 })

  return (
    <div>
      <h2 className="px-1 pb-3 font-display text-xl font-extrabold tracking-tight">
        Order Summary
      </h2>
      <BillBreakdown
        lines={lines}
        total={{ label: "Total", amount: order.total ?? 0 }}
        currencyCode={order.currency_code}
      />
    </div>
  )
}

export default OrderSummary
