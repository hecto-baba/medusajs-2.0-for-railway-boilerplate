/**
 * Timezone helpers built on the platform's Intl API (no dependency: the
 * lockfile cannot be regenerated in every environment, and luxon is only a
 * transitive dependency here).
 *
 * The one operation the booking engine needs is "this local wall-clock time on
 * this local calendar date in zone Z -> a UTC instant", done per day so that a
 * 09:00 rule stays 09:00 local on both sides of a daylight-saving change.
 */

const dtfCache = new Map<string, Intl.DateTimeFormat>()

const getFormatter = (timeZone: string): Intl.DateTimeFormat => {
  let dtf = dtfCache.get(timeZone)
  if (!dtf) {
    dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    dtfCache.set(timeZone, dtf)
  }
  return dtf
}

export const isValidTimeZone = (timeZone: string): boolean => {
  if (!timeZone || typeof timeZone !== "string") return false
  try {
    new Intl.DateTimeFormat("en-US", { timeZone })
    return true
  } catch {
    return false
  }
}

export type LocalDate = { year: number; month: number; day: number }

const partsOf = (utcMs: number, timeZone: string) => {
  const parts = getFormatter(timeZone).formatToParts(new Date(utcMs))
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? NaN)
  let hour = get("hour")
  // Some engines report midnight as 24 even with h23.
  if (hour === 24) hour = 0
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour,
    minute: get("minute"),
    second: get("second"),
  }
}

/** Offset of `timeZone` from UTC at the given instant, in minutes (east = +). */
export const tzOffsetMinutes = (utcMs: number, timeZone: string): number => {
  const p = partsOf(utcMs, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  const wholeSecondMs = Math.floor(utcMs / 1000) * 1000
  return Math.round((asUtc - wholeSecondMs) / 60_000)
}

/** The local calendar date in `timeZone` at the given UTC instant. */
export const localDateAt = (utcMs: number, timeZone: string): LocalDate => {
  const p = partsOf(utcMs, timeZone)
  return { year: p.year, month: p.month, day: p.day }
}

/** Local weekday (0 = Sunday) and minutes since local midnight at a UTC instant. */
export const localDayAndMinutesAt = (
  utcMs: number,
  timeZone: string
): { dayOfWeek: number; minutes: number; date: LocalDate } => {
  const p = partsOf(utcMs, timeZone)
  const date = { year: p.year, month: p.month, day: p.day }
  return {
    date,
    dayOfWeek: new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay(),
    minutes: p.hour * 60 + p.minute,
  }
}

/**
 * UTC instant (ms) for `minutesOfDay` on the local date in `timeZone`.
 *
 * Handles daylight-saving transitions: a wall-clock time that is repeated in
 * autumn resolves to its first occurrence; one that does not exist in spring
 * resolves to the instant just before the gap.
 */
export const localToUtcMs = (
  date: LocalDate,
  minutesOfDay: number,
  timeZone: string
): number => {
  const naive = Date.UTC(date.year, date.month - 1, date.day, 0, minutesOfDay)
  const offset1 = tzOffsetMinutes(naive, timeZone)
  let utc = naive - offset1 * 60_000
  const offset2 = tzOffsetMinutes(utc, timeZone)
  if (offset2 !== offset1) {
    utc = naive - offset2 * 60_000
  }
  return utc
}

export const compareLocalDates = (a: LocalDate, b: LocalDate): number =>
  a.year - b.year || a.month - b.month || a.day - b.day

export const addLocalDays = (date: LocalDate, days: number): LocalDate => {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days))
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  }
}

/** 0 = Sunday ... 6 = Saturday, for a calendar date (timezone independent). */
export const dayOfWeekOf = (date: LocalDate): number =>
  new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay()

const pad = (n: number) => String(n).padStart(2, "0")

/** "YYYY-MM-DD" key for a local calendar date. */
export const localDateKey = (date: LocalDate): string =>
  `${date.year}-${pad(date.month)}-${pad(date.day)}`

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/

export const isValidHHmm = (value: unknown): value is string =>
  typeof value === "string" && HHMM.test(value)

export const hhmmToMinutes = (value: string): number => {
  const m = HHMM.exec(value)
  if (!m) {
    throw new RangeError(`Invalid time "${value}", expected HH:mm`)
  }
  return Number(m[1]) * 60 + Number(m[2])
}
