/**
 * Display helpers for the admin appointment screens. Times are shown in the
 * resource's own timezone, never the admin's browser zone.
 */

export const browserTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

export const getTimeZones = (): string[] => {
  try {
    const fn = (Intl as any).supportedValuesOf
    if (typeof fn === "function") return fn("timeZone") as string[]
  } catch {
    // fall through
  }
  return ["UTC", "Asia/Kolkata", "Europe/London", "America/New_York", "America/Los_Angeles"]
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

export const localDateKey = (iso: string | Date, timeZone: string): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso))

export const addDaysToKey = (key: string, days: number): string => {
  const d = new Date(`${key}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Calendar dates (stored as UTC midnight) must be shown in UTC. */
export const formatCalendarDate = (value: string | Date) =>
  new Date(value).toLocaleDateString(undefined, { timeZone: "UTC" })
