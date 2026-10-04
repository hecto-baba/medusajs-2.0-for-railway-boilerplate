"use client"

import { clx } from "@medusajs/ui"

import { EoiQuote } from "@lib/util/eoi"
import { convertToLocale } from "@lib/util/money"

type EoiOptionsProps = {
  quote: EoiQuote
  /** True when "reserve with a deposit" is the chosen way to buy. */
  isEoi: boolean
  onChange: (mode: "buy" | "eoi") => void
}

const Option = ({
  selected,
  onSelect,
  title,
  text,
  amount,
  testId,
}: {
  selected: boolean
  onSelect: () => void
  title: string
  text: React.ReactNode
  amount: string
  testId: string
}) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    onClick={onSelect}
    className={clx(
      "flex items-start gap-3 rounded-[14px] border-[1.5px] p-3.5 text-left transition-colors",
      selected ? "border-brand bg-brand-soft" : "border-line bg-card hover:border-muted"
    )}
    data-testid={testId}
  >
    <span className="flex-1">
      <b className="block text-sm">{title}</b>
      <small className="text-xs leading-snug text-muted">{text}</small>
    </span>
    <b className="font-display text-lg tabular-nums">{amount}</b>
  </button>
)

/**
 * Choice between paying in full and reserving with a deposit (an Expression of
 * Interest). Shown only for a variant with an active EOI configuration.
 */
const EoiOptions = ({ quote, isEoi, onChange }: EoiOptionsProps) => {
  const money = (amount: number) =>
    convertToLocale({ amount, currency_code: quote.currencyCode })

  return (
    <div
      className="mt-2 grid gap-2.5"
      role="radiogroup"
      aria-label="How do you want to buy"
      data-testid="eoi-options"
    >
      <Option
        selected={!isEoi}
        onSelect={() => onChange("buy")}
        title="Buy at full price"
        text="Pay the full amount now."
        amount={money(quote.unitPrice)}
        testId="eoi-option-buy"
      />
      <Option
        selected={isEoi}
        onSelect={() => onChange("eoi")}
        title="Express interest and reserve"
        text={
          <>
            Pay{" "}
            {quote.valueType === "percentage"
              ? `${quote.valueAmount}%`
              : "a deposit"}{" "}
            now. The balance of {money(quote.remaining)} is tracked on your
            order and is not charged at checkout.
          </>
        }
        amount={money(quote.charged)}
        testId="eoi-option-reserve"
      />
    </div>
  )
}

export default EoiOptions
