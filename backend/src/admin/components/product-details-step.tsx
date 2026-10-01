import { Badge, Button, IconButton, Input, Label, Select, Text } from "@medusajs/ui"
import { Plus, XMark } from "@medusajs/icons"
import { useState } from "react"
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
  const [singleDate, setSingleDate] = useState("")
  const selectedVenue = venues.find((venue) => venue.id === value.venue_id)

  const handleAddSingleDate = () => {
    if (!singleDate) return
    const iso = new Date(singleDate + "T12:00:00Z").toISOString()
    const dayStr = singleDate
    if (value.dates.some((d) => d.startsWith(dayStr))) {
      return
    }
    onChange({
      dates: [...value.dates, iso].sort(
        (a, b) => new Date(a).getTime() - new Date(b).getTime()
      ),
    })
    setSingleDate("")
  }

  const handleAddRunDates = () => {
    if (!value.range_start || !value.range_end) return
    const newDates = expandDateRange(value.range_start, value.range_end)
    const existingDays = new Set(value.dates.map((d) => d.split("T")[0]))
    const combined = [...value.dates]
    for (const d of newDates) {
      const day = d.split("T")[0]
      if (!existingDays.has(day)) {
        combined.push(d)
        existingDays.add(day)
      }
    }
    onChange({
      dates: combined.sort(
        (a, b) => new Date(a).getTime() - new Date(b).getTime()
      ),
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

      <div className="flex flex-col gap-4">
        <div>
          <Label size="small" weight="plus">
            Show dates & schedule
          </Label>
          <Text size="xsmall" className="text-ui-fg-subtle">
            Add individual performance dates or generate a consecutive date range.
          </Text>
        </div>

        {/* Single date adder */}
        <div className="flex flex-col gap-2 bg-ui-bg-subtle p-3 rounded-lg border border-ui-border-base">
          <Label size="xsmall" weight="plus">
            Add Single Performance Date
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              size="small"
              value={singleDate}
              onChange={(e) => setSingleDate(e.target.value)}
            />
            <Button
              type="button"
              size="small"
              variant="secondary"
              disabled={!singleDate}
              onClick={handleAddSingleDate}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Date
            </Button>
          </div>
        </div>

        {/* Date range generator */}
        <div className="flex flex-col gap-2 bg-ui-bg-subtle p-3 rounded-lg border border-ui-border-base">
          <Label size="xsmall" weight="plus">
            Or Generate Consecutive Run
          </Label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label size="xsmall" className="text-ui-fg-subtle">
                From
              </Label>
              <Input
                type="date"
                size="small"
                value={value.range_start}
                onChange={(event) =>
                  onChange({ range_start: event.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label size="xsmall" className="text-ui-fg-subtle">
                To
              </Label>
              <Input
                type="date"
                size="small"
                value={value.range_end}
                min={value.range_start || undefined}
                onChange={(event) =>
                  onChange({ range_end: event.target.value })
                }
              />
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <Button
              type="button"
              size="small"
              variant="secondary"
              disabled={!value.range_start || !value.range_end}
              onClick={handleAddRunDates}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Range
            </Button>
          </div>
        </div>

        {/* Scheduled dates list / chips */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label size="small" weight="plus">
              Scheduled Performance Dates ({value.dates.length})
            </Label>
            {value.dates.length > 0 && (
              <Button
                type="button"
                size="small"
                variant="transparent"
                onClick={() => onChange({ dates: [] })}
                className="text-ui-fg-error"
              >
                Clear all
              </Button>
            )}
          </div>

          {value.dates.length === 0 ? (
            <div className="p-4 border border-dashed rounded-lg text-center text-ui-fg-subtle text-xs">
              No performance dates added yet. Pick a single date or date range above.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 bg-ui-bg-subtle rounded-lg border border-ui-border-base">
              {value.dates.map((date) => (
                <Badge key={date} size="small" className="flex items-center gap-1">
                  {new Date(date).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
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
