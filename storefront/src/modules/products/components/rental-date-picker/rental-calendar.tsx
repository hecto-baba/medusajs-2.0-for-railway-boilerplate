"use client"

import "react-day-picker/style.css"
import { DayPicker, DateRange } from "react-day-picker"

type RentalCalendarProps = {
  selected: Date | undefined
  onSelect: (date: Date | undefined) => void
  fromDate: Date
  bookedRanges: DateRange[]
  disabled?: boolean
}

/**
 * Thin wrapper around react-day-picker, themed to this store's palette via
 * its CSS custom properties rather than per-element classNames overrides -
 * the library exposes the whole look through --rdp-* variables, so a plain
 * style block on the wrapper is enough to match Medusa UI's near-black
 * accent instead of the library's default blue.
 */
export default function RentalCalendar({
  selected,
  onSelect,
  fromDate,
  bookedRanges,
  disabled,
}: RentalCalendarProps) {
  return (
    <div
      className="rounded-md border border-ui-border-base bg-ui-bg-field p-2"
      data-testid="rental-calendar"
      style={
        {
          "--rdp-accent-color": "#18181b",
          "--rdp-accent-background-color": "#f4f4f5",
          "--rdp-today-color": "#18181b",
          "--rdp-day-width": "38px",
          "--rdp-day-height": "38px",
          "--rdp-day_button-width": "36px",
          "--rdp-day_button-height": "36px",
        } as React.CSSProperties
      }
    >
      <DayPicker
        mode="single"
        selected={selected}
        onSelect={onSelect}
        startMonth={fromDate}
        disabled={disabled ? true : [{ before: fromDate }, ...bookedRanges]}
        modifiers={{ booked: bookedRanges }}
        modifiersClassNames={{
          booked: "line-through text-ui-fg-disabled",
        }}
      />
    </div>
  )
}
