import { Text } from "@medusajs/ui"
import { RentalUnit } from "types/rental"
import { UNIT_LABEL, UNIT_LABEL_PLURAL } from "@lib/util/rental-units"

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
 * Rental dates (and, when present, the unit/pickup-return time) travel on the
 * line item's metadata rather than on the variant, so they are rendered
 * separately from the variant options. A line item with no rental metadata
 * is an ordinary purchase and renders nothing.
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
  const unit = (metadata?.rental_unit as RentalUnit | undefined) ?? "day"
  const unitsCount = Number(metadata?.rental_units_count)
  const pickupTime = metadata?.rental_pickup_time as string | undefined
  const returnTime = metadata?.rental_return_time as string | undefined

  const quantityLabel = Number.isFinite(unitsCount) && unitsCount > 0
    ? `${unitsCount} ${unitsCount === 1 ? UNIT_LABEL[unit].toLowerCase() : UNIT_LABEL_PLURAL[unit]}`
    : Number.isFinite(days) && days > 0
      ? `${days} ${days === 1 ? "day" : "days"}`
      : ""

  return (
    <div className="flex flex-col w-full" data-testid={dataTestid}>
      <Text className="inline-block txt-medium text-muted w-full overflow-hidden text-ellipsis">
        Rental: {start} - {end}
        {quantityLabel ? ` (${quantityLabel})` : ""}
      </Text>
      {typeof metadata?.rental_fulfilment === "string" && (
        <Text className="inline-block txt-small text-muted w-full overflow-hidden text-ellipsis">
          {metadata.rental_fulfilment === "pickup"
            ? "Pick up from the seller"
            : "Delivered to you"}
        </Text>
      )}
      {(pickupTime || returnTime) && (
        <Text className="inline-block txt-small text-muted w-full overflow-hidden text-ellipsis">
          Pickup {pickupTime ?? "—"} / Return {returnTime ?? "—"}
        </Text>
      )}
    </div>
  )
}

export default LineItemRentalDates
