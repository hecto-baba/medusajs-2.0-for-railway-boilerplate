"use client"

import { clx, Label, Text } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { RentalConfiguration, RentalSelection, RentalUnit } from "types/rental"
import { getRentalAvailability, getRentalBookedRanges } from "@lib/data/rentals"
import {
  UNIT_DAY_SIZE,
  UNIT_LABEL,
  UNIT_LABEL_PLURAL,
  countRentalDays,
  countRentalHours,
  countRentalUnits,
  parseDateInputValue,
  toDateInputValue,
  toDateTimeInputValue,
} from "@lib/util/rental-units"
import RentalCalendar from "./rental-calendar"
import type { DateRange } from "react-day-picker"

type RentalDatePickerProps = {
  productId: string
  variantId?: string
  rentalConfiguration: RentalConfiguration
  currencyCode?: string
  disabled?: boolean
  onSelectionChange: (selection: RentalSelection | null) => void
  onPriceChange: (price: number | null) => void
  onDepositChange: (deposit: number | null) => void
}

// A shopper adjusting a time input can fire several onChange events before
// settling (typing digits, scrubbing a mobile time-picker's hour/minute
// spinners) - debouncing the availability check avoids firing one network
// request per intermediate value for what should be a single final check.
const AVAILABILITY_CHECK_DEBOUNCE_MS = 400

/**
 * Min/max are stored per-unit as *_units, with the legacy *_days columns kept
 * only for configs created before that migration. A config missing the unit
 * fields (min_rental_units undefined) is read as a day-unit config using the
 * legacy values, so nothing built before this component existed breaks.
 */
function resolveUnitConfig(config: RentalConfiguration) {
  const unit: RentalUnit = config.rental_unit ?? "day"
  const min = config.min_rental_units ?? config.min_rental_days
  const max =
    config.max_rental_units !== undefined
      ? config.max_rental_units
      : config.max_rental_days
  return { unit, min, max }
}

export default function RentalDatePicker({
  productId,
  variantId,
  rentalConfiguration,
  currencyCode,
  disabled,
  onSelectionChange,
  onPriceChange,
  onDepositChange,
}: RentalDatePickerProps) {
  const { unit, min, max } = resolveUnitConfig(rentalConfiguration)
  const requiresTime = rentalConfiguration.requires_time_selection

  // Rentals cannot start in the past, so today is the earliest selectable day
  // and the sensible default - every unit rolls forward from "now", never
  // snapping to a calendar week/month boundary.
  const today = useMemo(() => toDateInputValue(new Date()), [])

  const [startDate, setStartDate] = useState(today)
  const [unitsCount, setUnitsCount] = useState(min)
  const [hourDay, setHourDay] = useState(today)
  const [hourStart, setHourStart] = useState("")
  const [hourEnd, setHourEnd] = useState("")
  const [pickupTime, setPickupTime] = useState("")
  const [returnTime, setReturnTime] = useState("")
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [bookedRanges, setBookedRanges] = useState<DateRange[]>([])

  // For day/week/month/custom, the end date is derived from the start date
  // and the chosen unit count - the shopper picks "how many", not a second
  // calendar date, so the two can never disagree about the span's length.
  // Derived directly rather than mirrored into its own state+effect: that
  // pattern caused an extra render per change, with a stale intermediate
  // value visible to every dependent computation until the effect committed.
  const endDate = useMemo(() => {
    if (unit === "hour" || !startDate) {
      return ""
    }
    const unitSizeInDays = UNIT_DAY_SIZE[unit]
    const spanDays = unitsCount * unitSizeInDays
    const d = new Date(startDate)
    d.setDate(d.getDate() + spanDays - 1)
    return toDateInputValue(d)
  }, [unit, startDate, unitsCount])

  // Availability is per variant/unit, so switching either clears whatever was
  // already picked rather than silently re-quoting under the new selection.
  const resetKey = `${variantId ?? ""}:${unit}`
  const previousResetKey = useRef(resetKey)
  useEffect(() => {
    if (previousResetKey.current !== resetKey) {
      previousResetKey.current = resetKey
      setStartDate(today)
      setUnitsCount(min)
      setHourDay(today)
      setHourStart("")
      setHourEnd("")
      setPickupTime("")
      setReturnTime("")
      setAvailable(null)
      setError(null)
    }
  }, [resetKey, today, min])

  // Booked ranges are a UX preview for the calendar (strike through what's
  // already taken) - a snapshot fetched once per variant, not re-checked on
  // every keystroke. rental-availability, checked under a lock at
  // add-to-cart and again at checkout, remains the actual source of truth,
  // so a range that changes between this fetch and submission is still
  // caught correctly there even though this snapshot won't reflect it.
  useEffect(() => {
    if (!variantId) {
      setBookedRanges([])
      return
    }

    let cancelled = false
    const from = today
    const to = toDateInputValue(new Date(new Date(today).setMonth(new Date(today).getMonth() + 6)))

    getRentalBookedRanges({ productId, variantId, from, to })
      .then((result) => {
        if (cancelled) return
        setBookedRanges(
          (result?.booked_ranges ?? []).map((range) => ({
            from: new Date(range.start_date),
            to: new Date(range.end_date),
          }))
        )
      })
      .catch(() => {
        // A failed preview fetch just means no dates show as blocked ahead
        // of time - rental-availability still catches an actually-taken
        // range when the shopper submits one, so this fails open silently.
        if (!cancelled) setBookedRanges([])
      })

    return () => {
      cancelled = true
    }
  }, [productId, variantId, today])

  // Date inputs (and the unit stepper) can each fire several updates before a
  // response returns. Only the newest request may write state, or an earlier
  // "available" reply landing after a later "unavailable" one would quote a
  // price for a period the server actually refused.
  const requestRef = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const rentalDays = useMemo(() => {
    if (unit === "hour") {
      return hourStart && hourEnd ? 1 : null
    }
    if (!startDate || !endDate) {
      return null
    }
    return countRentalDays(startDate, endDate)
  }, [unit, startDate, endDate, hourStart, hourEnd])

  const effectiveUnitsCount = useMemo(() => {
    if (unit === "hour") {
      return hourStart && hourEnd ? countRentalHours(hourStart, hourEnd) : null
    }
    if (unit === "day" || unit === "custom") {
      return rentalDays
    }
    // week / month
    return rentalDays !== null ? countRentalUnits(rentalDays, unit) : null
  }, [unit, rentalDays, hourStart, hourEnd])

  const unitNounSingular = UNIT_LABEL[unit]
  const unitNounPlural = UNIT_LABEL_PLURAL[unit]

  /**
   * Checks the period against the configured limits before asking the server.
   * Catching an obviously invalid range here keeps a request off the wire and
   * gives the shopper the reason immediately; the backend enforces the same
   * rules regardless.
   */
  const localValidationError = useMemo(() => {
    if (unit === "hour") {
      if (!hourDay || !hourStart || !hourEnd) {
        return null
      }
      if (hourEnd <= hourStart) {
        return "The end time must be after the start time."
      }
    } else {
      if (!startDate || !endDate) {
        return null
      }
      if (new Date(endDate) < new Date(startDate)) {
        return "The return date must be on or after the pickup date."
      }
    }

    if (effectiveUnitsCount === null) {
      return null
    }

    if (effectiveUnitsCount < min) {
      return `This item rents for a minimum of ${min} ${
        min === 1 ? unitNounSingular.toLowerCase() : unitNounPlural
      }.`
    }

    if (max !== null && effectiveUnitsCount > max) {
      return `This item rents for a maximum of ${max} ${
        max === 1 ? unitNounSingular.toLowerCase() : unitNounPlural
      }.`
    }

    if (requiresTime && (!pickupTime || !returnTime)) {
      return "Please choose a pickup and return time."
    }

    return null
  }, [
    unit,
    startDate,
    endDate,
    hourDay,
    hourStart,
    hourEnd,
    effectiveUnitsCount,
    min,
    max,
    unitNounSingular,
    unitNounPlural,
    requiresTime,
    pickupTime,
    returnTime,
  ])

  const clearSelection = useCallback(() => {
    onSelectionChange(null)
    onPriceChange(null)
    onDepositChange(null)
  }, [onSelectionChange, onPriceChange, onDepositChange])

  const checkAvailability = useCallback(async () => {
    // Hour bookings carry real time-of-day: sending a bare date would leave
    // the server unable to tell a 2-hour booking from a 20-hour one, so the
    // date and time are combined into one instant for both ends of the range.
    const checkStart =
      unit === "hour"
        ? hourStart
          ? toDateTimeInputValue(hourDay, hourStart)
          : ""
        : startDate
    const checkEnd =
      unit === "hour"
        ? hourEnd
          ? toDateTimeInputValue(hourDay, hourEnd)
          : ""
        : endDate

    if (!variantId || !checkStart || !checkEnd || rentalDays === null) {
      return
    }

    if (localValidationError) {
      setAvailable(null)
      setError(localValidationError)
      clearSelection()
      return
    }

    const requestId = ++requestRef.current

    setIsChecking(true)
    setError(null)

    try {
      const result = await getRentalAvailability({
        productId,
        variantId,
        startDate: checkStart,
        endDate: checkEnd,
        currencyCode,
      })

      if (requestId !== requestRef.current) {
        return
      }

      setAvailable(result.available)

      if (!result.available) {
        setError("These dates are already booked. Please choose another period.")
        clearSelection()
        return
      }

      onSelectionChange({
        rental_start_date: checkStart,
        rental_end_date: checkEnd,
        rental_days: rentalDays,
        rental_unit: unit,
        rental_units_count: effectiveUnitsCount ?? rentalDays,
        pickup_time: requiresTime ? pickupTime : unit === "hour" ? hourStart : null,
        return_time: requiresTime ? returnTime : unit === "hour" ? hourEnd : null,
        deposit_amount: result.deposit?.amount ?? 0,
      })
      onPriceChange(result.price?.amount ?? null)
      onDepositChange(result.deposit?.amount ?? null)
    } catch (e: any) {
      if (requestId !== requestRef.current) {
        return
      }

      // A failed availability check must not look like an available period.
      setAvailable(null)
      setError(
        e?.message ?? "Could not check availability. Please try again."
      )
      clearSelection()
    } finally {
      if (requestId === requestRef.current) {
        setIsChecking(false)
      }
    }
  }, [
    unit,
    productId,
    variantId,
    startDate,
    endDate,
    hourDay,
    hourStart,
    hourEnd,
    rentalDays,
    effectiveUnitsCount,
    currencyCode,
    localValidationError,
    requiresTime,
    pickupTime,
    returnTime,
    onSelectionChange,
    onPriceChange,
    onDepositChange,
    clearSelection,
  ])

  // Re-check whenever the dates, unit, variant, or time selection change,
  // debounced so a burst of time-input changes settles into one request.
  useEffect(() => {
    const hasSelection = unit === "hour" ? !!(hourDay && hourStart && hourEnd) : !!(startDate && endDate)

    if (!hasSelection) {
      setAvailable(null)
      setError(null)
      clearSelection()
      return
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      checkAvailability()
    }, AVAILABILITY_CHECK_DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkAvailability, unit, startDate, endDate, hourDay, hourStart, hourEnd, pickupTime, returnTime])

  const message = error ?? localValidationError

  return (
    <div className="flex flex-col gap-y-3" data-testid="rental-date-picker">
      <div className="flex flex-col gap-y-1">
        <Text className="text-ui-fg-base font-medium">Rental period</Text>
        <Text className="txt-medium text-ui-fg-subtle">
          {max !== null
            ? `Rent this item for ${min} to ${max} ${unitNounPlural}.`
            : `Rent this item for ${min} ${
                min === 1 ? unitNounSingular.toLowerCase() : unitNounPlural
              } or more.`}
        </Text>
      </div>

      {unit === "hour" ? (
        <>
          <div className="flex flex-col gap-y-1">
            <Label htmlFor="rental-hour-day" className="txt-medium">
              Date
            </Label>
            <RentalCalendar
              selected={hourDay ? parseDateInputValue(hourDay) : undefined}
              onSelect={(date) => setHourDay(date ? toDateInputValue(date) : "")}
              fromDate={parseDateInputValue(today)}
              bookedRanges={bookedRanges}
              disabled={disabled}
            />
          </div>
          <div className="grid grid-cols-2 gap-x-3">
            <div className="flex flex-col gap-y-1">
              <Label htmlFor="rental-hour-start" className="txt-medium">
                Start time
              </Label>
              <input
                id="rental-hour-start"
                type="time"
                value={hourStart}
                disabled={disabled || !hourDay}
                onChange={(e) => setHourStart(e.target.value)}
                className="border-ui-border-base bg-ui-bg-field h-10 rounded-md border px-3 txt-medium disabled:opacity-50"
                data-testid="rental-hour-start"
              />
            </div>
            <div className="flex flex-col gap-y-1">
              <Label htmlFor="rental-hour-end" className="txt-medium">
                End time
              </Label>
              <input
                id="rental-hour-end"
                type="time"
                value={hourEnd}
                disabled={disabled || !hourStart}
                onChange={(e) => setHourEnd(e.target.value)}
                className="border-ui-border-base bg-ui-bg-field h-10 rounded-md border px-3 txt-medium disabled:opacity-50"
                data-testid="rental-hour-end"
              />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-y-1">
            <Label htmlFor="rental-start-date" className="txt-medium">
              Pickup date
            </Label>
            <RentalCalendar
              selected={startDate ? parseDateInputValue(startDate) : undefined}
              onSelect={(date) => setStartDate(date ? toDateInputValue(date) : "")}
              fromDate={parseDateInputValue(today)}
              bookedRanges={bookedRanges}
              disabled={disabled}
            />
          </div>

          <div className="flex flex-col gap-y-1">
            <Label htmlFor="rental-units-count" className="txt-medium">
              Number of {unitNounPlural}
            </Label>
            <div className="flex items-center gap-x-2">
              <button
                type="button"
                aria-label={`Decrease number of ${unitNounPlural}`}
                disabled={disabled || unitsCount <= min}
                onClick={() => setUnitsCount((c) => Math.max(min, c - 1))}
                className="border-ui-border-base bg-ui-bg-field h-10 w-10 rounded-md border txt-medium disabled:opacity-50"
              >
                –
              </button>
              <input
                id="rental-units-count"
                type="number"
                min={min}
                max={max ?? undefined}
                value={unitsCount}
                disabled={disabled}
                onChange={(e) => {
                  const v = Number(e.target.value) || min
                  setUnitsCount(max !== null ? Math.min(max, Math.max(min, v)) : Math.max(min, v))
                }}
                className="border-ui-border-base bg-ui-bg-field h-10 w-20 rounded-md border px-3 txt-medium text-center disabled:opacity-50"
                data-testid="rental-units-count"
              />
              <button
                type="button"
                aria-label={`Increase number of ${unitNounPlural}`}
                disabled={disabled || (max !== null && unitsCount >= max)}
                onClick={() =>
                  setUnitsCount((c) => (max !== null ? Math.min(max, c + 1) : c + 1))
                }
                className="border-ui-border-base bg-ui-bg-field h-10 w-10 rounded-md border txt-medium disabled:opacity-50"
              >
                +
              </button>
            </div>
          </div>
        </>
      )}

      {requiresTime && (
        <div className="grid grid-cols-2 gap-x-3">
          <div className="flex flex-col gap-y-1">
            <Label htmlFor="rental-pickup-time" className="txt-medium">
              Pickup time
            </Label>
            <input
              id="rental-pickup-time"
              type="time"
              value={pickupTime}
              disabled={disabled}
              onChange={(e) => setPickupTime(e.target.value)}
              className="border-ui-border-base bg-ui-bg-field h-10 rounded-md border px-3 txt-medium disabled:opacity-50"
              data-testid="rental-pickup-time"
            />
          </div>
          <div className="flex flex-col gap-y-1">
            <Label htmlFor="rental-return-time" className="txt-medium">
              Return time
            </Label>
            <input
              id="rental-return-time"
              type="time"
              value={returnTime}
              disabled={disabled}
              onChange={(e) => setReturnTime(e.target.value)}
              className="border-ui-border-base bg-ui-bg-field h-10 rounded-md border px-3 txt-medium disabled:opacity-50"
              data-testid="rental-return-time"
            />
          </div>
        </div>
      )}

      {effectiveUnitsCount !== null && !message && (
        <Text className="txt-medium text-ui-fg-subtle">
          {effectiveUnitsCount} {effectiveUnitsCount === 1 ? unitNounSingular.toLowerCase() : unitNounPlural}
          {isChecking && " - checking availability..."}
        </Text>
      )}

      {message && (
        <Text
          className={clx("txt-medium text-ui-fg-error")}
          data-testid="rental-error-message"
        >
          {message}
        </Text>
      )}

      {available && !message && !isChecking && (
        <Text
          className="txt-medium text-ui-fg-interactive"
          data-testid="rental-available-message"
        >
          Available for these dates.
        </Text>
      )}
    </div>
  )
}
