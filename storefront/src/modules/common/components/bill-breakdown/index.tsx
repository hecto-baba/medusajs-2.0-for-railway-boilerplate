import { clx } from "@medusajs/ui"
import React from "react"

import { convertToLocale } from "@lib/util/money"

export type BillLine = {
  label: string
  /** Amount in major units. Use `text` to show words such as "FREE" instead. */
  amount?: number
  text?: string
  tone?: "default" | "success" | "muted"
  /** Struck-through amount shown before the real one (item total before savings). */
  strikeAmount?: number
  testId?: string
}

type BillBreakdownProps = {
  lines: BillLine[]
  total: { label: string; amount: number }
  currencyCode: string
  /** Total savings. The green banner is hidden when 0 or not set. */
  savings?: number
  /** Extra rows shown under the total (for example "Balance due later"). */
  footerLines?: BillLine[]
}

const Row = ({
  line,
  currencyCode,
}: {
  line: BillLine
  currencyCode: string
}) => (
  <div
    className={clx("flex justify-between gap-4 tabular-nums", {
      "text-xs text-muted": line.tone === "muted",
    })}
    data-testid={line.testId}
  >
    <span>{line.label}</span>
    <span className={clx({ "font-bold text-success": line.tone === "success" })}>
      {typeof line.strikeAmount === "number" && (
        <s className="mr-1.5 text-muted">
          {convertToLocale({
            amount: line.strikeAmount,
            currency_code: currencyCode,
          })}
        </s>
      )}
      {line.text ??
        convertToLocale({
          amount: line.amount ?? 0,
          currency_code: currencyCode,
        })}
    </span>
  </div>
)

const BillBreakdown = ({
  lines,
  total,
  currencyCode,
  savings,
  footerLines,
}: BillBreakdownProps) => (
  <div className="grid gap-3" data-testid="bill-breakdown">
    {typeof savings === "number" && savings > 0 && (
      <div
        className="flex items-center gap-2 rounded-large bg-success-soft px-3.5 py-2.5 text-sm font-bold text-success"
        data-testid="bill-savings"
      >
        You are saving{" "}
        {convertToLocale({ amount: savings, currency_code: currencyCode })} on
        this order
      </div>
    )}
    <div className="grid gap-2.5 rounded-large bg-card p-4 text-sm shadow-lift">
      {lines.map((line) => (
        <Row key={line.label} line={line} currencyCode={currencyCode} />
      ))}
      <div
        className="flex justify-between border-t border-dashed border-line pt-3 text-base font-extrabold tabular-nums"
        data-testid="bill-total"
      >
        <span>{total.label}</span>
        <span>
          {convertToLocale({
            amount: total.amount,
            currency_code: currencyCode,
          })}
        </span>
      </div>
      {footerLines?.map((line) => (
        <Row key={line.label} line={line} currencyCode={currencyCode} />
      ))}
    </div>
  </div>
)

export default BillBreakdown
