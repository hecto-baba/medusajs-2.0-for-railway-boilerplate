"use client"

import { Text } from "@medusajs/ui"
import { VendorRowType, VendorVenueRow } from "@lib/data/vendor-client"

export const ROW_TYPES: VendorRowType[] = ["vip", "premium", "balcony", "standard"]

export const ROW_TYPE_STYLES: Record<
  VendorRowType,
  { label: string; badgeColor: "purple" | "orange" | "blue" | "grey"; swatch: string }
> = {
  vip: {
    label: "VIP",
    badgeColor: "purple",
    swatch: "bg-purple-100 border-purple-300 text-purple-800 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-300",
  },
  premium: {
    label: "Premium",
    badgeColor: "orange",
    swatch: "bg-orange-100 border-orange-300 text-orange-800 dark:bg-orange-950 dark:border-orange-800 dark:text-orange-300",
  },
  balcony: {
    label: "Balcony",
    badgeColor: "blue",
    swatch: "bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300",
  },
  standard: {
    label: "Standard",
    badgeColor: "grey",
    swatch: "bg-ui-bg-base border-ui-border-base text-ui-fg-base",
  },
}

type SeatChartRow = Pick<VendorVenueRow, "row_number" | "row_type" | "seat_count">

type SeatChartProps = {
  rows: SeatChartRow[]
  maxSeatsPerRow?: number
}

/**
 * Draws a venue's rows as an interactive stage-facing seating plan.
 */
export const SeatChart = ({ rows, maxSeatsPerRow = 24 }: SeatChartProps) => {
  const usableRows = rows.filter(
    (row) => row.row_number?.trim() && row.seat_count > 0
  )

  const totalSeats = usableRows.reduce(
    (total, row) => total + (Number(row.seat_count) || 0),
    0
  )

  if (!usableRows.length) {
    return (
      <div className="border-ui-border-base bg-ui-bg-subtle rounded-lg border border-dashed p-8 text-center">
        <Text size="small" className="text-ui-fg-subtle">
          Add rows to preview the stage-facing seating plan
        </Text>
      </div>
    )
  }

  return (
    <div className="border-ui-border-base bg-ui-bg-subtle rounded-lg border p-5">
      {/* Stage Marker */}
      <div className="bg-ui-bg-component text-ui-fg-subtle mb-6 rounded-md py-1.5 text-center shadow-elevation-card-rest border border-ui-border-base">
        <Text size="xsmall" weight="plus" className="tracking-widest">
          STAGE / FRONT
        </Text>
      </div>

      {/* Rows Matrix */}
      <div className="flex flex-col gap-3">
        {usableRows.map((row, index) => {
          const style =
            ROW_TYPE_STYLES[row.row_type] ?? ROW_TYPE_STYLES.standard

          const seatsToDraw = Math.min(row.seat_count, maxSeatsPerRow)

          return (
            <div
              key={`${row.row_number}-${index}`}
              className="flex items-center gap-3"
            >
              {/* Row Label */}
              <div className="w-8 shrink-0 text-center font-bold">
                <Text size="xsmall" weight="plus" className="text-ui-fg-base">
                  {row.row_number}
                </Text>
              </div>

              {/* Individual Seats */}
              <div className="flex flex-1 flex-wrap gap-1.5 items-center">
                {Array.from({ length: seatsToDraw }, (_, seatIndex) => (
                  <div
                    key={seatIndex}
                    className={`h-5 w-5 rounded border text-[9px] flex items-center justify-center font-mono cursor-default select-none transition-transform hover:scale-110 ${style.swatch}`}
                    title={`Row ${row.row_number}, seat ${seatIndex + 1} (${style.label})`}
                  >
                    {seatIndex + 1}
                  </div>
                ))}
                {row.seat_count > seatsToDraw && (
                  <Text size="xsmall" className="text-ui-fg-muted pl-1">
                    +{row.seat_count - seatsToDraw} more
                  </Text>
                )}
              </div>

              {/* Tier and Count Info */}
              <div className="w-28 shrink-0 text-right">
                <Text size="xsmall" className="text-ui-fg-subtle">
                  <span className="font-medium text-ui-fg-base">{style.label}</span> &middot; {row.seat_count} seats
                </Text>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer Summary */}
      <div className="border-ui-border-base mt-6 flex items-center justify-between border-t pt-3">
        <Text size="xsmall" className="text-ui-fg-subtle">
          {usableRows.length} {usableRows.length === 1 ? "seating row" : "seating rows"}
        </Text>
        <Text size="xsmall" weight="plus" className="text-ui-fg-base">
          Total Capacity: {totalSeats} seats
        </Text>
      </div>
    </div>
  )
}
