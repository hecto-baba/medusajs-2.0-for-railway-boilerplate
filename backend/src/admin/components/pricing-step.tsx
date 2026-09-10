import { Badge, Input, Label, Text } from "@medusajs/ui"
import { ROW_TYPE_STYLES, RowType, VenueRow } from "../types/ticket-booking"

/** Price per currency for one seating tier, keyed by currency code. */
export type TierPrices = Record<string, string>

export type PricingDraft = Record<string, TierPrices>

type PricingStepProps = {
  rowTypes: RowType[]
  rows: VenueRow[]
  currencies: string[]
  value: PricingDraft
  onChange: (rowType: RowType, currency: string, amount: string) => void
}

const seatsForTier = (rows: VenueRow[], rowType: RowType) =>
  rows
    .filter((row) => row.row_type === rowType)
    .reduce((total, row) => total + row.seat_count, 0)

export const PricingStep = ({
  rowTypes,
  rows,
  currencies,
  value,
  onChange,
}: PricingStepProps) => {
  if (!rowTypes.length) {
    return (
      <Text size="small" className="text-ui-fg-subtle">
        Select a venue with seating rows to price its tiers.
      </Text>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Label size="small" weight="plus">
          Ticket prices
        </Label>
        <Text size="xsmall" className="text-ui-fg-subtle">
          Each tier is priced once and applies to every date of the run. Leave a
          tier blank to leave it unpriced for now.
        </Text>
      </div>

      {rowTypes.map((rowType) => {
        const style = ROW_TYPE_STYLES[rowType]

        return (
          <div
            key={rowType}
            className="border-ui-border-base flex flex-col gap-3 rounded-lg border p-4"
          >
            <div className="flex items-center justify-between">
              <Badge size="small" className={style.badge}>
                {style.label}
              </Badge>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {seatsForTier(rows, rowType)} seats per performance
              </Text>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {currencies.map((currency) => (
                <div key={currency} className="flex flex-col gap-1">
                  <Label size="xsmall" className="text-ui-fg-subtle">
                    {currency.toUpperCase()}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={value[rowType]?.[currency] ?? ""}
                    onChange={(event) =>
                      onChange(rowType, currency, event.target.value)
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default PricingStep
