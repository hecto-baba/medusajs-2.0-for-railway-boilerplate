/**
 * Display helpers for the appointments screens. Every time a seller sees is shown
 * in the RESOURCE's timezone (that is the clock its weekly hours are written
 * in), never the browser's, so "09:00" always means 09:00 for that resource.
 */

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

/** Monday-first order for the weekly-hours screen. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

const FALLBACK_ZONES = [
  "UTC",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
]

export const getTimeZones = (): string[] => {
  try {
    const fn = (Intl as any).supportedValuesOf
    if (typeof fn === "function") return fn("timeZone") as string[]
  } catch {
    // fall through
  }
  return FALLBACK_ZONES
}

export const browserTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

export const isKnownTimeZone = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value })
    return true
  } catch {
    return false
  }
}

export const formatInZone = (
  iso: string | Date,
  timeZone: string | null | undefined,
  options: Intl.DateTimeFormatOptions
): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return String(iso)
  try {
    return date.toLocaleString("en-US", { timeZone: timeZone ?? undefined, ...options })
  } catch {
    return date.toLocaleString("en-US", options)
  }
}

export const formatSlotDateTime = (iso: string, timeZone: string | null | undefined) =>
  formatInZone(iso, timeZone, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })

export const formatTime = (iso: string, timeZone: string | null | undefined) =>
  formatInZone(iso, timeZone, { hour: "numeric", minute: "2-digit" })

/** "YYYY-MM-DD" of the instant in the given zone. */
export const localDateKey = (iso: string | Date, timeZone: string): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso))

/** "HH:mm" (24h) of the instant in the given zone. */
export const localHHmm = (iso: string | Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00"
  return `${get("hour")}:${get("minute")}`
}

/** Calendar dates (stored as UTC midnight) must be shown in UTC, not the browser zone. */
export const formatCalendarDate = (value: string | Date) =>
  new Date(value).toLocaleDateString(undefined, {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  })

export const todayKey = (timeZone: string): string => localDateKey(new Date(), timeZone)

export const addDaysToKey = (key: string, days: number): string => {
  const d = new Date(`${key}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export const money = (value: number | null | undefined, currency?: string | null) => {
  if (value === null || value === undefined) return "-"
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format(value)
  } catch {
    return String(value)
  }
}
