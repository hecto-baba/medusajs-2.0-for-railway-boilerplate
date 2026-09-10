"use client"

import { clx, Label, Text } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { RentalConfiguration, RentalSelection } from "types/rental"
import { getRentalAvailability } from "@lib/data/rentals"

type RentalDatePickerProps = {
  productId: string
  variantId?: string
  rentalConfiguration: RentalConfiguration
  currencyCode?: string
  disabled?: boolean
  onSelectionChange: (selection: RentalSelection | null) => void
  onPriceChange: (price: number | null) => void
}

/**
 * Formats a date as YYYY-MM-DD in the *local* calendar. toISOString() would
 * convert to UTC first, so for anyone behind UTC an evening visit reported
 * tomorrow's date - which, used as the min= below, made today unselectable.
 */
const toDateInputValue = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

/**
 * The backend counts a rental inclusively - renting for the 15th to the 15th
 * is one day, not zero - so the same arithmetic has to be used here or the
 * quoted period would disagree with the one the server validates against.
 */
const countRentalDays = (start: string, end: string) => {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diff = endDate.getTime() - startDate.getTime()

  return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1
}

export default function RentalDatePicker({
  productId,
  variantId,
  rentalConfiguration,
  currencyCode,
  disabled,
  onSelectionChange,
  onPriceChange,
}: RentalDatePickerProps) {
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [available, setAvailable] = useState<boolean | null>(null)

  // Date inputs fire a change per edited segment, so several availability
  // checks can be in flight at once. Only the newest may write state:
  // otherwise an earlier "available" reply can land after a later
  // "unavailable" one and quote a price for dates the server refused.
  const requestRef = useRef(0)

  // Rentals cannot start in the past, so today is the earliest selectable day.
  const today = useMemo(() => toDateInputValue(new Date()), [])

  const rentalDays = useMemo(() => {
    if (!startDate || !endDate) {
      return null
    }

    return countRentalDays(startDate, endDate)
  }, [startDate, endDate])

  const { min_rental_days, max_rental_days } = rentalConfiguration

  /**
   * Checks the period against the configured limits before asking the server.
   * Catching an obviously invalid range here keeps a request off the wire and
   * gives the shopper the reason immediately; the backend enforces the same
   * rules regardless.
   */
  const localValidationError = useMemo(() => {
    if (!startDate || !endDate || rentalDays === null) {
      return null
    }

    if (new Date(endDate) < new Date(startDate)) {
      return "The return date must be on or after the pickup date."
    }

    if (rentalDays < min_rental_days) {
      return `This item rents for a minimum of ${min_rental_days} ${
        min_rental_days === 1 ? "day" : "days"
      }.`
    }

    if (max_rental_days !== null && rentalDays > max_rental_days) {
      return `This item rents for a maximum of ${max_rental_days} ${
        max_rental_days === 1 ? "day" : "days"
      }.`
    }

    return null
  }, [startDate, endDate, rentalDays, min_rental_days, max_rental_days])

  const checkAvailability = useCallback(async () => {
    if (!variantId || !startDate || !endDate || rentalDays === null) {
      return
    }

    if (localValidationError) {
      setAvailable(null)
      setError(localValidationError)
      onSelectionChange(null)
      onPriceChange(null)
      return
    }

    const requestId = ++requestRef.current

    setIsChecking(true)
    setError(null)

    try {
      const result = await getRentalAvailability({
        productId,
        variantId,
        startDate,
        endDate,
        currencyCode,
      })

      if (requestId !== requestRef.current) {
        return
      }

      setAvailable(result.available)

      if (!result.available) {
        setError("These dates are already booked. Please choose another period.")
        onSelectionChange(null)
        onPriceChange(null)
        return
      }

      onSelectionChange({
        rental_start_date: startDate,
        rental_end_date: endDate,
        rental_days: rentalDays,
      })
      onPriceChange(result.price?.amount ?? null)
    } catch (e: any) {
      if (requestId !== requestRef.current) {
        return
      }

      // A failed availability check must not look like an available period.
      setAvailable(null)
      setError(
        e?.message ?? "Could not check availability. Please try again."
      )
      onSelectionChange(null)
      onPriceChange(null)
    } finally {
      if (requestId === requestRef.current) {
        setIsChecking(false)
      }
    }
  }, [
    productId,
    variantId,
    startDate,
    endDate,
    rentalDays,
    currencyCode,
    localValidationError,
    onSelectionChange,
    onPriceChange,
  ])

  // Re-check whenever the dates or the selected variant change. Availability
  // is per variant, so switching size after picking dates has to re-ask.
  useEffect(() => {
    if (!startDate || !endDate) {
      setAvailable(null)
      setError(null)
      onSelectionChange(null)
      onPriceChange(null)
      return
    }

    checkAvailability()
  }, [checkAvailability, startDate, endDate, onSelectionChange, onPriceChange])

  const message = error ?? localValidationError

  return (
    <div className="flex flex-col gap-y-3" data-testid="rental-date-picker">
      <div className="flex flex-col gap-y-1">
        <Text className="text-ui-fg-base font-medium">Rental period</Text>
        <Text className="txt-medium text-ui-fg-subtle">
          {max_rental_days !== null
            ? `Rent this item for ${min_rental_days} to ${max_rental_days} days.`
            : `Rent this item for ${min_rental_days} day${
                min_rental_days === 1 ? "" : "s"
              } or more.`}
        </Text>
      </div>

      <div className="grid grid-cols-2 gap-x-3">
        <div className="flex flex-col gap-y-1">
          <Label htmlFor="rental-start-date" className="txt-medium">
            Pickup
          </Label>
          <input
            id="rental-start-date"
            type="date"
            min={today}
            value={startDate}
            disabled={disabled}
            onChange={(e) => setStartDate(e.target.value)}
            className="border-ui-border-base bg-ui-bg-field h-10 rounded-md border px-3 txt-medium disabled:opacity-50"
            data-testid="rental-start-date"
          />
        </div>

        <div className="flex flex-col gap-y-1">
          <Label htmlFor="rental-end-date" className="txt-medium">
            Return
          </Label>
          <input
            id="rental-end-date"
            type="date"
            min={startDate || today}
            value={endDate}
            disabled={disabled || !startDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border-ui-border-base bg-ui-bg-field h-10 rounded-md border px-3 txt-medium disabled:opacity-50"
            data-testid="rental-end-date"
          />
        </div>
      </div>

      {rentalDays !== null && !message && (
        <Text className="txt-medium text-ui-fg-subtle">
          {rentalDays} {rentalDays === 1 ? "day" : "days"}
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
