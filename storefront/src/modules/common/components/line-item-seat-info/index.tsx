import { Text } from "@medusajs/ui"
import { ROW_TYPE_LABELS, RowType } from "types/ticket"

type LineItemSeatInfoProps = {
  metadata?: Record<string, unknown> | null
  "data-testid"?: string
}

const formatShowDate = (value: unknown) => {
  if (typeof value !== "string" && typeof value !== "number") {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/**
 * Seat details travel on the line item's metadata rather than on the variant,
 * so they render separately from the variant options. A line item with no seat
 * metadata is an ordinary purchase and renders nothing.
 */
const LineItemSeatInfo = ({
  metadata,
  "data-testid": dataTestid,
}: LineItemSeatInfoProps) => {
  const seatNumber = metadata?.seat_number
  const showDate = formatShowDate(metadata?.show_date)

  if (!seatNumber || !showDate) {
    return null
  }

  const rowNumber = metadata?.row_number
  const rowType = metadata?.row_type as RowType | undefined
  const tierLabel = rowType ? ROW_TYPE_LABELS[rowType] : null

  return (
    <Text
      data-testid={dataTestid}
      className="inline-block txt-medium text-ui-fg-subtle w-full overflow-hidden text-ellipsis"
    >
      {showDate}
      {" · "}
      {rowNumber ? `Row ${rowNumber}, ` : ""}
      Seat {String(seatNumber)}
      {tierLabel ? ` (${tierLabel})` : ""}
    </Text>
  )
}

export default LineItemSeatInfo
