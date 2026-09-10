import { Badge, Input, Label, Select, Text, IconButton } from "@medusajs/ui"
import { XMark } from "@medusajs/icons"
import {
  ROW_TYPE_STYLES,
  totalSeats,
  Venue,
  venueRowTypes,
} from "../types/ticket-booking"
import { SeatChart } from "./seat-chart"

export type ShowDetailsDraft = {
  name: string
  description: string
  venue_id: string
  dates: string[]
  /** Kept so the range inputs stay controlled as the derived dates change. */
  range_start: string
  range_end: string
}

type ProductDetailsStepProps = {
  venues: Venue[]
  value: ShowDetailsDraft
  onChange: (patch: Partial<ShowDetailsDraft>) => void
}

/** Every calendar day from start to end inclusive, as ISO strings. */
const expandDateRange = (start: string, end: string): string[] => {
  const startDate = new Date(start)
  const endDate = new Date(end)

  if (isNaN(startDate.valueOf()) || isNaN(endDate.valueOf())) {
    return []
  }

  if (endDate < startDate) {
    return []
  }

  const dates: string[] = []
  const cursor = new Date(startDate)

  // Guard against a range so wide it would create thousands of variants.
  while (cursor <= endDate && dates.length < 60) {
    dates.push(new Date(cursor).toISOString())
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

export const ProductDetailsStep = ({
  venues,
  value,
  onChange,
}: ProductDetailsStepProps) => {
  const selectedVenue = venues.find((venue) => venue.id === value.venue_id)

  const applyRange = (start: string, end: string) => {
    onChange({
      range_start: start,
      range_end: end,
      dates: start ? expandDateRange(start, end || start) : [],
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label size="small" weight="plus">
            Show name
          </Label>
          <Input
            value={value.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="A Midsummer Night's Dream"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label size="small" weight="plus">
            Venue
          </Label>
          <Select
            value={value.venue_id}
            onValueChange={(venueId) => onChange({ venue_id: venueId })}
          >
            <Select.Trigger>
              <Select.Value placeholder="Select a venue" />
            </Select.Trigger>
            <Select.Content>
              {venues.map((venue) => (
                <Select.Item key={venue.id} value={venue.id}>
                  {venue.name} ({totalSeats(venue.rows)} seats)
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label size="small" weight="plus">
          Description
          <span className="text-ui-fg-muted"> (optional)</span>
        </Label>
        <Input
          value={value.description}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder="Shakespeare in the park"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <Label size="small" weight="plus">
            Show dates
          </Label>
          <Text size="xsmall" className="text-ui-fg-subtle">
            Pick a range to generate one performance per day, then remove any
            day the show is dark.
          </Text>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label size="xsmall" className="text-ui-fg-subtle">
              From
            </Label>
            <Input
              type="date"
              value={value.range_start}
              onChange={(event) =>
                applyRange(event.target.value, value.range_end)
              }
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label size="xsmall" className="text-ui-fg-subtle">
              To
            </Label>
            <Input
              type="date"
              value={value.range_end}
              min={value.range_start || undefined}
              onChange={(event) =>
                applyRange(value.range_start, event.target.value)
              }
            />
          </div>
        </div>

        {value.dates.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {value.dates.map((date) => (
              <Badge key={date} size="small" className="flex items-center gap-1">
                {new Date(date).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
                <IconButton
                  size="2xsmall"
                  variant="transparent"
                  onClick={() =>
                    onChange({
                      dates: value.dates.filter((kept) => kept !== date),
                    })
                  }
                >
                  <XMark />
                </IconButton>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {selectedVenue && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label size="small" weight="plus">
              {selectedVenue.name}
            </Label>
            <div className="flex gap-1">
              {venueRowTypes(selectedVenue.rows).map((rowType) => (
                <Badge
                  key={rowType}
                  size="2xsmall"
                  className={ROW_TYPE_STYLES[rowType].badge}
                >
                  {ROW_TYPE_STYLES[rowType].label}
                </Badge>
              ))}
            </div>
          </div>
          <SeatChart rows={selectedVenue.rows || []} />
        </div>
      )}
    </div>
  )
}

export default ProductDetailsStep
