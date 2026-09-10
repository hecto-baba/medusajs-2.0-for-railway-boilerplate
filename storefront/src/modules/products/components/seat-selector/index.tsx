"use client"

import { Button, Text, clx } from "@medusajs/ui"
import { useEffect, useMemo, useState, useTransition } from "react"
import { useParams } from "next/navigation"
import {
  ROW_TYPE_LABELS,
  SeatMapRow,
  SelectedSeat,
  ShowDateAvailability,
  TicketProductSeats,
} from "types/ticket"
import { addTicketsToCart, getTicketProductSeats } from "@lib/data/tickets"

type SeatSelectorProps = {
  productId: string
  availability: ShowDateAvailability[]
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })

const seatKey = (rowNumber: string, seatNumber: string) =>
  `${rowNumber}-${seatNumber}`

const SeatSelector = ({ productId, availability }: SeatSelectorProps) => {
  const { countryCode } = useParams() as { countryCode: string }

  const firstBookable = availability.find((date) => !date.is_sold_out)

  const [selectedDate, setSelectedDate] = useState<string | null>(
    firstBookable?.date ?? null
  )
  const [seatMap, setSeatMap] = useState<TicketProductSeats | null>(null)
  const [selected, setSelected] = useState<SelectedSeat[]>([])
  const [isLoadingSeats, setIsLoadingSeats] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Changing the date invalidates the current selection: a seat is only
  // meaningful for the performance it was picked for.
  useEffect(() => {
    if (!selectedDate) {
      setSeatMap(null)
      return
    }

    let cancelled = false
    setIsLoadingSeats(true)
    setSelected([])
    setError(null)

    getTicketProductSeats(productId, selectedDate)
      .then((result) => {
        if (!cancelled) setSeatMap(result)
      })
      .catch((fetchError: any) => {
        if (!cancelled) {
          setError(fetchError?.message || "Could not load seats")
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSeats(false)
      })

    return () => {
      cancelled = true
    }
  }, [productId, selectedDate])

  const toggleSeat = (row: SeatMapRow, seatNumber: string) => {
    if (!row.variant_id || !selectedDate) return

    const key = seatKey(row.row_number, seatNumber)

    setSelected((current) => {
      const existing = current.find(
        (seat) => seatKey(seat.row_number, seat.seat_number) === key
      )

      if (existing) {
        return current.filter(
          (seat) => seatKey(seat.row_number, seat.seat_number) !== key
        )
      }

      return [
        ...current,
        {
          seat_number: seatNumber,
          row_number: row.row_number,
          venue_row_id: row.venue_row_id,
          variant_id: row.variant_id as string,
          row_type: row.row_type,
          show_date: selectedDate,
        },
      ]
    })
  }

  const selectedKeys = useMemo(
    () => new Set(selected.map((seat) => seatKey(seat.row_number, seat.seat_number))),
    [selected]
  )

  const handleAddToCart = () => {
    setError(null)
    startTransition(async () => {
      try {
        await addTicketsToCart({ seats: selected, countryCode })
        setSelected([])
        // Re-read the map so seats taken while choosing show as unavailable.
        if (selectedDate) {
          const refreshed = await getTicketProductSeats(productId, selectedDate)
          setSeatMap(refreshed)
        }
      } catch (addError: any) {
        setError(addError?.message || "Could not add these seats to your cart")
      }
    })
  }

  if (!availability.length) {
    return (
      <Text className="text-ui-fg-subtle">
        No performances are currently on sale.
      </Text>
    )
  }

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-col gap-y-3">
        <Text className="text-ui-fg-base font-medium">Choose a date</Text>
        <div className="flex flex-wrap gap-2">
          {availability.map((date) => {
            const isSelected = date.date === selectedDate

            return (
              <button
                key={date.date}
                type="button"
                disabled={date.is_sold_out}
                onClick={() => setSelectedDate(date.date)}
                className={clx(
                  "flex flex-col items-start rounded-rounded border px-3 py-2 text-left transition-colors",
                  {
                    "border-ui-border-interactive bg-ui-bg-interactive text-ui-fg-on-color":
                      isSelected,
                    "border-ui-border-base hover:border-ui-border-interactive":
                      !isSelected && !date.is_sold_out,
                    "border-ui-border-base opacity-50 cursor-not-allowed":
                      date.is_sold_out,
                  }
                )}
              >
                <span className="text-small-regular">
                  {formatDate(date.date)}
                </span>
                <span className="text-xsmall-regular opacity-80">
                  {date.is_sold_out
                    ? "Sold out"
                    : `${formatTime(date.date)} · ${date.seats_available} left`}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {isLoadingSeats && (
        <Text className="text-ui-fg-subtle">Loading seats...</Text>
      )}

      {seatMap && !isLoadingSeats && (
        <div className="flex flex-col gap-y-4">
          <div className="rounded-rounded bg-ui-bg-subtle py-1 text-center">
            <Text className="text-xsmall-regular uppercase tracking-wider text-ui-fg-subtle">
              Stage
            </Text>
          </div>

          <div className="flex flex-col gap-y-2">
            {seatMap.seat_map.map((row) => (
              <div key={row.venue_row_id} className="flex items-center gap-x-3">
                <Text className="w-6 shrink-0 text-xsmall-regular text-ui-fg-subtle">
                  {row.row_number}
                </Text>

                <div className="flex flex-1 flex-wrap gap-1">
                  {row.seats.map((seat) => {
                    const isSelected = selectedKeys.has(
                      seatKey(row.row_number, seat.seat_number)
                    )
                    const isDisabled = !seat.is_available || !row.variant_id

                    return (
                      <button
                        key={seat.seat_number}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => toggleSeat(row, seat.seat_number)}
                        title={`Row ${row.row_number}, seat ${seat.seat_number}`}
                        aria-label={`Row ${row.row_number} seat ${seat.seat_number}${
                          isDisabled ? " unavailable" : ""
                        }`}
                        aria-pressed={isSelected}
                        className={clx(
                          "h-6 w-6 rounded-sm border text-[10px] leading-none transition-colors",
                          {
                            "border-ui-border-interactive bg-ui-bg-interactive text-ui-fg-on-color":
                              isSelected,
                            "border-ui-border-base bg-ui-bg-base hover:border-ui-border-interactive":
                              !isSelected && !isDisabled,
                            "border-ui-border-base bg-ui-bg-disabled text-ui-fg-disabled cursor-not-allowed":
                              isDisabled,
                          }
                        )}
                      >
                        {seat.seat_number}
                      </button>
                    )
                  })}
                </div>

                <Text className="w-16 shrink-0 text-right text-xsmall-regular text-ui-fg-muted">
                  {ROW_TYPE_LABELS[row.row_type] ?? row.row_type}
                </Text>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-x-1.5">
              <span className="h-3 w-3 rounded-sm border border-ui-border-base bg-ui-bg-base" />
              <Text className="text-xsmall-regular text-ui-fg-subtle">
                Available
              </Text>
            </span>
            <span className="flex items-center gap-x-1.5">
              <span className="h-3 w-3 rounded-sm border border-ui-border-interactive bg-ui-bg-interactive" />
              <Text className="text-xsmall-regular text-ui-fg-subtle">
                Selected
              </Text>
            </span>
            <span className="flex items-center gap-x-1.5">
              <span className="h-3 w-3 rounded-sm border border-ui-border-base bg-ui-bg-disabled" />
              <Text className="text-xsmall-regular text-ui-fg-subtle">Taken</Text>
            </span>
          </div>
        </div>
      )}

      {error && (
        <Text className="text-ui-fg-error text-small-regular">{error}</Text>
      )}

      <Button
        onClick={handleAddToCart}
        disabled={!selected.length || isPending}
        isLoading={isPending}
        className="w-full h-10"
        data-testid="add-tickets-button"
      >
        {selected.length
          ? `Add ${selected.length} ${
              selected.length === 1 ? "ticket" : "tickets"
            } to cart`
          : "Select a seat"}
      </Button>
    </div>
  )
}

export default SeatSelector
