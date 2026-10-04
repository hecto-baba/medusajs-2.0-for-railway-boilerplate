"use client"

import { clx } from "@medusajs/ui"
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

const TIER_SEAT: Record<string, string> = {
  vip: "border-pop-ink/30 bg-pop text-pop-ink hover:border-ink",
  premium: "border-brand/40 bg-brand-soft text-brand hover:border-brand",
  balcony: "border-success/40 bg-success-soft text-success hover:border-success",
  standard: "border-line bg-card text-ink hover:border-ink",
}

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
      <p className="text-muted">No performances are currently on sale.</p>
    )
  }

  // Tiers present in the current map, in the order they first appear.
  const tiersInMap = seatMap
    ? Array.from(new Set(seatMap.seat_map.map((row) => row.row_type)))
    : []

  return (
    <div className="flex flex-col gap-y-5" data-testid="seat-selector">
      <div className="flex flex-col gap-y-3">
        <p className="font-extrabold text-ink">Choose a date</p>
        <div className="flex flex-wrap gap-2">
          {availability.map((date) => {
            const isSelected = date.date === selectedDate

            return (
              <button
                key={date.date}
                type="button"
                disabled={date.is_sold_out}
                aria-pressed={isSelected}
                onClick={() => setSelectedDate(date.date)}
                className={clx(
                  "flex flex-col items-start rounded-[12px] border px-3 py-2 text-left transition-colors",
                  {
                    "border-brand bg-brand-soft text-brand": isSelected,
                    "border-line bg-card text-ink hover:border-brand":
                      !isSelected && !date.is_sold_out,
                    "cursor-not-allowed border-line bg-canvas text-muted opacity-60":
                      date.is_sold_out,
                  }
                )}
              >
                <span className="text-sm font-extrabold" suppressHydrationWarning>
                  {formatDate(date.date)}
                </span>
                <span className="text-xs opacity-80" suppressHydrationWarning>
                  {date.is_sold_out
                    ? "Sold out"
                    : `${formatTime(date.date)} · ${date.seats_available} left`}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {isLoadingSeats && <p className="text-muted">Loading seats...</p>}

      {seatMap && !isLoadingSeats && (
        <div className="flex flex-col gap-y-4 rounded-large bg-card p-4 shadow-lift">
          <div className="rounded-rounded bg-ink py-1.5 text-center">
            <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-canvas">
              Stage
            </span>
          </div>

          <div className="flex flex-col gap-y-2 overflow-x-auto">
            {seatMap.seat_map.map((row) => (
              <div key={row.venue_row_id} className="flex items-center gap-x-3">
                <span className="w-6 shrink-0 text-xs font-bold text-muted">
                  {row.row_number}
                </span>

                <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
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
                          "h-7 w-7 rounded-[6px] border text-[10px] font-bold leading-none transition-colors",
                          {
                            "border-ink bg-ink text-canvas": isSelected,
                            [TIER_SEAT[row.row_type] ?? TIER_SEAT.standard]:
                              !isSelected && !isDisabled,
                            "cursor-not-allowed border-line bg-canvas text-muted opacity-50 line-through":
                              isDisabled && !isSelected,
                          }
                        )}
                      >
                        {seat.seat_number}
                      </button>
                    )
                  })}
                </div>

                <span className="hidden w-16 shrink-0 text-right text-xs text-muted xsmall:block">
                  {ROW_TYPE_LABELS[row.row_type] ?? row.row_type}
                </span>
              </div>
            ))}
          </div>

          <div
            className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3"
            data-testid="seat-legend"
          >
            {tiersInMap.map((tier) => (
              <span key={tier} className="flex items-center gap-x-1.5">
                <span
                  className={clx(
                    "h-3.5 w-3.5 rounded-[4px] border",
                    TIER_SEAT[tier] ?? TIER_SEAT.standard
                  )}
                />
                <span className="text-xs text-muted">
                  {ROW_TYPE_LABELS[tier] ?? tier}
                </span>
              </span>
            ))}
            <span className="flex items-center gap-x-1.5">
              <span className="h-3.5 w-3.5 rounded-[4px] border border-ink bg-ink" />
              <span className="text-xs text-muted">Selected</span>
            </span>
            <span className="flex items-center gap-x-1.5">
              <span className="h-3.5 w-3.5 rounded-[4px] border border-line bg-canvas opacity-50" />
              <span className="text-xs text-muted">Taken</span>
            </span>
          </div>
        </div>
      )}

      {error && <p className="text-sm font-bold text-brand">{error}</p>}

      <div
        className="sticky bottom-3 z-10 flex flex-col gap-y-2 rounded-large border border-line bg-card p-4 shadow-pop"
        data-testid="seat-summary"
      >
        {selected.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((seat) => (
              <span
                key={seatKey(seat.row_number, seat.seat_number)}
                className="rounded-circle bg-canvas px-2.5 py-1 text-xs font-bold text-ink"
              >
                Row {seat.row_number}, seat {seat.seat_number}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No seats selected yet.</p>
        )}
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!selected.length || isPending}
          className="h-12 w-full rounded-large bg-brand text-base font-extrabold text-brand-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="add-tickets-button"
        >
          {isPending
            ? "Adding..."
            : selected.length
            ? `Add ${selected.length} ${
                selected.length === 1 ? "ticket" : "tickets"
              } to cart`
            : "Select a seat"}
        </button>
      </div>
    </div>
  )
}

export default SeatSelector
