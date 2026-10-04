"use client"

import "react-day-picker/style.css"
import { DayPicker, DateRange } from "react-day-picker"

type RentalCalendarProps = {
  selected: Date | undefined
  onSelect: (date: Date | undefined) => void
  fromDate: Date
  bookedRanges: DateRange[]
  /** Last day of the chosen rental period, highlighted with the start day. */
  rangeEnd?: Date
  disabled?: boolean
}

/**
 * Thin wrapper around react-day-picker, themed to the store tokens through its
 * --rdp-* custom properties so light and dark follow the page. Booked days are
 * struck through and cannot be picked; the chosen span is highlighted.
 */
export default function RentalCalendar({
  selected,
  onSelect,
  fromDate,
  bookedRanges,
  rangeEnd,
  disabled,
}: RentalCalendarProps) {
  const span =
    selected && rangeEnd && rangeEnd > selected
      ? [{ from: selected, to: rangeEnd }]
      : []

  return (
    <div
      className="overflow-x-auto rounded-large border border-line bg-card p-3 text-ink"
      data-testid="rental-calendar"
      style={
        {
          "--rdp-accent-color": "rgb(var(--c-brand))",
          "--rdp-accent-background-color": "rgb(var(--c-brand-soft))",
          "--rdp-today-color": "rgb(var(--c-brand))",
          "--rdp-day-width": "40px",
          "--rdp-day-height": "40px",
          "--rdp-day_button-width": "38px",
          "--rdp-day_button-height": "38px",
          "--rdp-day_button-border-radius": "10px",
          "--rdp-selected-border": "2px solid rgb(var(--c-brand))",
        } as React.CSSProperties
      }
    >
      <DayPicker
        mode="single"
        selected={selected}
        onSelect={onSelect}
        startMonth={fromDate}
        disabled={disabled ? true : [{ before: fromDate }, ...bookedRanges]}
        modifiers={{ booked: bookedRanges, span }}
        modifiersClassNames={{
          booked: "line-through opacity-50",
          span: "[&>button]:bg-brand-soft [&>button]:text-ink",
        }}
      />
    </div>
  )
}
