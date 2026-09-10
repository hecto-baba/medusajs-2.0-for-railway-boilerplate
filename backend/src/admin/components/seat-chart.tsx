import { Text } from "@medusajs/ui"
import {
  ROW_TYPE_STYLES,
  RowType,
  totalSeats,
  VenueRow,
} from "../types/ticket-booking"

type SeatChartRow = Pick<VenueRow, "row_number" | "row_type" | "seat_count">

type SeatChartProps = {
  rows: SeatChartRow[]
  /** Caps how many seats are drawn per row before collapsing to a count. */
  maxSeatsPerRow?: number
}

/**
 * Draws a venue's rows as a stage-facing seating plan.
 *
 * Rows are shown in the order given rather than sorted, so what the chart
 * shows matches the order the rows were entered in the form above it.
 */
export const SeatChart = ({ rows, maxSeatsPerRow = 20 }: SeatChartProps) => {
  const usableRows = rows.filter(
    (row) => row.row_number?.trim() && row.seat_count > 0
  )

  if (!usableRows.length) {
    return (
      <div className="border-ui-border-base bg-ui-bg-subtle rounded-lg border border-dashed p-6 text-center">
        <Text size="small" className="text-ui-fg-subtle">
          Add a row to preview the seating plan
        </Text>
      </div>
    )
  }

  return (
    <div className="border-ui-border-base bg-ui-bg-subtle rounded-lg border p-4">
      <div className="bg-ui-bg-component text-ui-fg-subtle mb-4 rounded py-1 text-center">
        <Text size="xsmall" weight="plus">
          STAGE
        </Text>
      </div>

      <div className="flex flex-col gap-2">
        {usableRows.map((row, index) => {
          const style =
            ROW_TYPE_STYLES[row.row_type as RowType] ??
            ROW_TYPE_STYLES[RowType.STANDARD]

          const seatsToDraw = Math.min(row.seat_count, maxSeatsPerRow)

          return (
            <div
              key={`${row.row_number}-${index}`}
              className="flex items-center gap-3"
            >
              <div className="w-8 shrink-0 text-center">
                <Text size="xsmall" weight="plus" className="text-ui-fg-subtle">
                  {row.row_number}
                </Text>
              </div>

              <div className="flex flex-1 flex-wrap gap-1">
                {Array.from({ length: seatsToDraw }, (_, seatIndex) => (
                  <div
                    key={seatIndex}
                    className={`h-5 w-5 rounded-sm border ${style.swatch}`}
                    title={`Row ${row.row_number}, seat ${seatIndex + 1}`}
                  />
                ))}
                {row.seat_count > seatsToDraw && (
                  <Text size="xsmall" className="text-ui-fg-muted self-center">
                    +{row.seat_count - seatsToDraw}
                  </Text>
                )}
              </div>

              <Text size="xsmall" className="text-ui-fg-muted w-24 shrink-0 text-right">
                {style.label} &middot; {row.seat_count}
              </Text>
            </div>
          )
        })}
      </div>

      <div className="border-ui-border-base mt-4 flex items-center justify-between border-t pt-3">
        <Text size="xsmall" className="text-ui-fg-subtle">
          {usableRows.length} {usableRows.length === 1 ? "row" : "rows"}
        </Text>
        <Text size="xsmall" weight="plus">
          {totalSeats(usableRows as VenueRow[])} seats
        </Text>
      </div>
    </div>
  )
}

export default SeatChart
