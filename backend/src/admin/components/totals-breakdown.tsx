import type { AdminOrder } from "@medusajs/framework/types"
import { Text } from "@medusajs/ui"
import { ReactNode } from "react"
import { formatAmount } from "../utils/format-amount"

export const Total = ({
  label,
  value,
  secondaryValue,
  tooltip,
}: {
  label: string
  value: string | number
  secondaryValue?: string
  tooltip?: ReactNode
}) => (
  <div className="grid grid-cols-3 items-center">
    <Text size="small" leading="compact" className="text-ui-fg-subtle">
      {label} {tooltip}
    </Text>
    <div className="text-right">
      <Text size="small" leading="compact" className="text-ui-fg-muted">
        {secondaryValue || ""}
      </Text>
    </div>
    <div className="text-right font-mono">
      <Text size="small" leading="compact" weight="plus">
        {value}
      </Text>
    </div>
  </div>
)

export const TotalsBreakdown = ({ order }: { order: AdminOrder }) => {
  const discount = Number(order?.discount_total || 0)
  const currencyCode = order?.currency_code || "EUR"

  return (
    <div className="text-ui-fg-subtle flex flex-col gap-y-2 px-6 py-4 border-t">
      <Total
        label="Discounts"
        secondaryValue=""
        value={
          discount > 0
            ? `- ${formatAmount(discount, currencyCode)}`
            : "-"
        }
      />
      {(order?.shipping_methods || [])
        .slice()
        .sort((m1: any, m2: any) =>
          String(m1.created_at || "").localeCompare(String(m2.created_at || ""))
        )
        .map((sm: any, i: number) => {
          return (
            <div key={sm.id || i}>
              <Total
                label="Shipping"
                secondaryValue={sm.name}
                value={formatAmount(sm.total, currencyCode)}
              />
            </div>
          )
        })}
    </div>
  )
}
