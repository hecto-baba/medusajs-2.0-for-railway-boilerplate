import { Text } from "@medusajs/ui"

type LineItemRentalDatesProps = {
  metadata?: Record<string, unknown> | null
  "data-testid"?: string
}

const formatDate = (value: unknown) => {
  if (typeof value !== "string" && typeof value !== "number") {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

/**
 * Rental dates travel on the line item's metadata rather than on the variant,
 * so they are rendered separately from the variant options. A line item with
 * no rental metadata is an ordinary purchase and renders nothing.
 */
const LineItemRentalDates = ({
  metadata,
  "data-testid": dataTestid,
}: LineItemRentalDatesProps) => {
  const start = formatDate(metadata?.rental_start_date)
  const end = formatDate(metadata?.rental_end_date)

  if (!start || !end) {
    return null
  }

  const days = Number(metadata?.rental_days)

  return (
    <Text
      data-testid={dataTestid}
      className="inline-block txt-medium text-ui-fg-subtle w-full overflow-hidden text-ellipsis"
    >
      Rental: {start} - {end}
      {Number.isFinite(days) && days > 0
        ? ` (${days} ${days === 1 ? "day" : "days"})`
        : ""}
    </Text>
  )
}

export default LineItemRentalDates
