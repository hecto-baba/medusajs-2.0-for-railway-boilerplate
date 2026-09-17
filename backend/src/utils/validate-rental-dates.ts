import { MedusaError } from "@medusajs/framework/utils"
import { RentalUnit } from "./rental-unit"

const UNIT_NOUN: Record<RentalUnit, string> = {
  hour: "hour",
  day: "day",
  week: "week",
  month: "month",
  custom: "day",
}

export default function validateRentalDates(
  rentalStartDate: string | Date,
  rentalEndDate: string | Date,
  rentalConfiguration: {
    min_rental_days: number
    max_rental_days: number | null
    rental_unit?: RentalUnit
    min_rental_units?: number
    max_rental_units?: number | null
  },
  rentalDays: number | string,
  /** Quantity in the configured unit, e.g. "2" when rental_unit is "week". Defaults to rentalDays for day-unit configs, keeping existing callers unchanged. */
  unitsCount?: number | string
) {
  const startDate =
    rentalStartDate instanceof Date ? rentalStartDate : new Date(rentalStartDate)
  const endDate =
    rentalEndDate instanceof Date ? rentalEndDate : new Date(rentalEndDate)
  const days = typeof rentalDays === "number" ? rentalDays : Number(rentalDays)

  const unit = rentalConfiguration.rental_unit ?? "day"
  const unitNoun = UNIT_NOUN[unit]

  // Day/custom units are day-granular, so their unit count is just the day
  // count. Every other unit (week, month, hour) needs an explicit unitsCount:
  // hour in particular is never expressible as a day count (a 3-hour booking
  // and a 30-hour booking can both span "1 day"), so it must never silently
  // fall back to days the way isDayUnit's siblings can.
  const isDayUnit = unit === "day" || unit === "custom"
  const units = isDayUnit
    ? days
    : unitsCount !== undefined
      ? typeof unitsCount === "number"
        ? unitsCount
        : Number(unitsCount)
      : (() => {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            `unitsCount is required to validate a ${unit}-unit rental`
          )
        })()

  const min = rentalConfiguration.min_rental_units ?? rentalConfiguration.min_rental_days
  const max =
    rentalConfiguration.max_rental_units !== undefined
      ? rentalConfiguration.max_rental_units
      : rentalConfiguration.max_rental_days

  if (units < min) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Rental period of ${units} ${unitNoun}${units === 1 ? "" : "s"} is less than the minimum of ${min} ${unitNoun}${min === 1 ? "" : "s"}`
    )
  }

  if (max !== null && max !== undefined && units > max) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Rental period of ${units} ${unitNoun}${units === 1 ? "" : "s"} exceeds the maximum of ${max} ${unitNoun}${max === 1 ? "" : "s"}`
    )
  }

  if (unit === "hour") {
    // Hour bookings carry real time-of-day, so "in the past" has to mean the
    // actual instant, not just the calendar day - a booking for 08:00 today,
    // submitted at 15:00 today, is still in the past even though "today" is
    // not.
    const now = new Date()
    if (startDate < now || endDate < now) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Rental time cannot be in the past. Received start: ${startDate.toISOString()}, end: ${endDate.toISOString()}`
      )
    }
  } else {
    // Incoming dates are "YYYY-MM-DD" strings parsed as UTC midnight, so the
    // floor they are compared against has to be UTC midnight too. Using a
    // server-local midnight rejected a legitimately-chosen today whenever the
    // server sat ahead of the shopper.
    const now = new Date()
    now.setUTCHours(0, 0, 0, 0)
    if (startDate < now || endDate < now) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Rental dates cannot be in the past. Received start date: ${startDate.toISOString()}, end date: ${endDate.toISOString()}`
      )
    }
  }

  // Rental days are counted inclusively, so an end date equal to the start
  // date is a one-day rental rather than an empty period. Only an end date
  // strictly before the start is invalid.
  if (endDate < startDate) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `rentalEndDate must be on or after rentalStartDate`
    )
  }
}
