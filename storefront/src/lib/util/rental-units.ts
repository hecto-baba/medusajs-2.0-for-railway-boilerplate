import { RentalUnit } from "types/rental"

export const UNIT_LABEL: Record<RentalUnit, string> = {
  hour: "Hour",
  day: "Day",
  week: "Week",
  month: "Month",
  custom: "Day",
}

export const UNIT_LABEL_PLURAL: Record<RentalUnit, string> = {
  hour: "hours",
  day: "days",
  week: "weeks",
  month: "months",
  custom: "days",
}

export const UNIT_DAY_SIZE: Record<Exclude<RentalUnit, "hour">, number> = {
  day: 1,
  week: 7,
  month: 30,
  custom: 1,
}

/**
 * The backend counts a rental inclusively - renting for the 15th to the 15th
 * is one day, not zero - so the same arithmetic has to be used here or the
 * quoted period would disagree with the one the server validates against.
 * Normalizes to UTC calendar components first (matching
 * backend/src/utils/count-rental-days.ts exactly), rather than diffing raw
 * epoch millis, so a value carrying a time-of-day component can't shift the
 * day count by rounding differently than the server.
 */
export const countRentalDays = (start: string, end: string) => {
  const startDate = new Date(start)
  const endDate = new Date(end)

  const startUtc = Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate()
  )
  const endUtc = Date.UTC(
    endDate.getUTCFullYear(),
    endDate.getUTCMonth(),
    endDate.getUTCDate()
  )

  return Math.round((endUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1
}

/**
 * Converts a day count into a quantity in the given rental unit. Day-count is
 * ground truth (matches countRentalDays); week/month/custom derive from it.
 * Mirrors backend/src/utils/count-rental-units.ts's day-unit branch exactly,
 * so a shopper's quoted "2 weeks" always matches what the server bills for
 * the same dates. Hour is not day-granular - see countRentalHours.
 */
export const countRentalUnits = (
  days: number,
  unit: Exclude<RentalUnit, "hour">
) => {
  return Math.max(1, Math.round(days / UNIT_DAY_SIZE[unit]))
}

/**
 * Elapsed whole hours between two "HH:mm" times on the same day. Mirrors
 * backend/src/utils/count-rental-units.ts's hour branch exactly.
 */
export const countRentalHours = (startTime: string, endTime: string) => {
  const [sh, sm] = startTime.split(":").map(Number)
  const [eh, em] = endTime.split(":").map(Number)
  const minutes = eh * 60 + em - (sh * 60 + sm)

  return minutes > 0 ? Math.max(1, Math.round(minutes / 60)) : null
}

export const toDateInputValue = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

/**
 * Parses a "YYYY-MM-DD" string as local midnight, the exact inverse of
 * toDateInputValue. `new Date("2026-01-15")` (no time component) parses as
 * UTC midnight per spec, which is the previous day in any timezone behind
 * UTC - this is the parse a calendar display/selection needs instead, so a
 * date chosen on-screen always round-trips to the same day shown.
 */
export const parseDateInputValue = (value: string) => {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

export const addDays = (date: string, days: number) => {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return toDateInputValue(d)
}

/**
 * Combines a "YYYY-MM-DD" date and an "HH:mm" time into a full local-time ISO
 * datetime string, for sending an hour-unit booking's real start/end instant
 * to the backend (as opposed to just a date, which is all the server needs
 * for day/week/month/custom units).
 */
export const toDateTimeInputValue = (date: string, time: string) => {
  return new Date(`${date}T${time}:00`).toISOString()
}
