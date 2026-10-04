import {
  LocalDate,
  addLocalDays,
  compareLocalDates,
  dayOfWeekOf,
  hhmmToMinutes,
  isValidHHmm,
  localDateAt,
  localDateKey,
  localToUtcMs,
} from "./timezone"

/**
 * Availability engine v2: pure computation, no I/O, no clock access (the caller
 * passes `now`). Everything a buyer sees - and everything a reservation is
 * re-validated against - comes from this one function.
 *
 *   weekly hours  -> minus holidays / partial time-off -> plus extra hours
 *   -> cut into slots (session length, step) in the resource's timezone
 *   -> drop slots inside the minimum-notice window or beyond the booking horizon
 *   -> drop slots whose buffered block collides with an existing booking
 *      (unless an identical booking already exists and still has room)
 */

const MINUTE_MS = 60_000
const DAY_MS = 86_400_000

export const MAX_RANGE_DAYS = 62
export const MAX_SLOTS = 10_000

export type ResourceSettings = {
  timezone: string
  session_duration_minutes: number
  slot_step_minutes?: number | null
  capacity: number
  buffer_before_minutes: number
  buffer_after_minutes: number
  min_notice_minutes: number
  max_advance_days: number
}

/** Per-service overrides on a resource (service_provider row). */
export type OfferingOverrides = {
  duration_minutes?: number | null
  capacity?: number | null
}

export type RecurringRule = {
  day_of_week: number
  start_time: string
  end_time: string
  effective_from: Date | string
  effective_until?: Date | string | null
  status?: string | null
}

export type ExceptionRule = {
  /** Calendar date, stored as UTC midnight of that date. */
  date: Date | string
  type: "blackout" | "extra_hours"
  start_time?: string | null
  end_time?: string | null
}

/** A non-cancelled booking row for the resource. */
export type ExistingAppointment = {
  id: string
  start_time: Date | string
  end_time: Date | string
  block_start?: Date | string | null
  block_end?: Date | string | null
  buffer_before_minutes?: number | null
  buffer_after_minutes?: number | null
  max_capacity: number
  /** The service this booking row was created for. */
  service_product_id?: string | null
  /** Attendees currently holding a place (reserved-and-live + confirmed). */
  active_attendees: number
}

export type Slot = {
  start: Date
  end: Date
  capacity: number
  capacity_remaining: number
  /** Present only when a booking row already exists for exactly this window. */
  appointment_id?: string
}

export type ComputeSlotsInput = {
  resource: ResourceSettings
  offering?: OfferingOverrides | null
  /**
   * The service being booked. A booking row can only be joined (group slots) by
   * the same service; a different service at the same time is treated as a
   * collision.
   */
  product_id?: string | null
  rules: RecurringRule[]
  exceptions: ExceptionRule[]
  existing: ExistingAppointment[]
  from: Date
  to: Date
  now: Date
}

type Minutes = { start: number; end: number }

const toMs = (value: Date | string): number => new Date(value).getTime()

const isoDateKey = (value: Date | string): string =>
  new Date(value).toISOString().slice(0, 10)

const assertPositiveInt = (name: string, value: number, min = 1) => {
  if (!Number.isInteger(value) || value < min) {
    throw new RangeError(`${name} must be an integer >= ${min}`)
  }
}

/** Sort and merge overlapping/touching minute windows. */
const mergeWindows = (windows: Minutes[]): Minutes[] => {
  const sorted = windows
    .filter((w) => w.end > w.start)
    .sort((a, b) => a.start - b.start || a.end - b.end)
  const out: Minutes[] = []
  for (const w of sorted) {
    const last = out[out.length - 1]
    if (last && w.start <= last.end) {
      last.end = Math.max(last.end, w.end)
    } else {
      out.push({ ...w })
    }
  }
  return out
}

const subtractWindow = (windows: Minutes[], remove: Minutes): Minutes[] => {
  const out: Minutes[] = []
  for (const w of windows) {
    if (remove.end <= w.start || remove.start >= w.end) {
      out.push(w)
      continue
    }
    if (remove.start > w.start) out.push({ start: w.start, end: remove.start })
    if (remove.end < w.end) out.push({ start: remove.end, end: w.end })
  }
  return out
}

type Block = {
  id: string
  productId: string | null
  start: number
  end: number
  blockStart: number
  blockEnd: number
  capacity: number
  active: number
}

const toBlock = (a: ExistingAppointment): Block => {
  const start = toMs(a.start_time)
  const end = toMs(a.end_time)
  const blockStart =
    a.block_start != null
      ? toMs(a.block_start)
      : start - (a.buffer_before_minutes ?? 0) * MINUTE_MS
  const blockEnd =
    a.block_end != null
      ? toMs(a.block_end)
      : end + (a.buffer_after_minutes ?? 0) * MINUTE_MS
  return {
    id: a.id,
    productId: a.service_product_id ?? null,
    start,
    end,
    blockStart,
    blockEnd,
    capacity: a.max_capacity,
    active: a.active_attendees,
  }
}

export const computeSlots = (input: ComputeSlotsInput): Slot[] => {
  const { resource, offering, rules, exceptions, existing, from, to, now } = input
  const productId = input.product_id ?? null
  const tz = resource.timezone

  const duration = offering?.duration_minutes ?? resource.session_duration_minutes
  const capacity = offering?.capacity ?? resource.capacity
  const step = resource.slot_step_minutes ?? duration
  const before = resource.buffer_before_minutes
  const after = resource.buffer_after_minutes

  assertPositiveInt("session duration", duration)
  assertPositiveInt("slot step", step)
  assertPositiveInt("capacity", capacity)
  assertPositiveInt("buffer before", before, 0)
  assertPositiveInt("buffer after", after, 0)

  const fromMs = from.getTime()
  const toMsValue = to.getTime()
  if (Number.isNaN(fromMs) || Number.isNaN(toMsValue)) {
    throw new RangeError("from/to must be valid dates")
  }
  if (toMsValue < fromMs) return []
  if (toMsValue - fromMs > MAX_RANGE_DAYS * DAY_MS) {
    throw new RangeError(`Date range may not exceed ${MAX_RANGE_DAYS} days`)
  }

  const earliest = now.getTime() + resource.min_notice_minutes * MINUTE_MS
  const latest = now.getTime() + resource.max_advance_days * DAY_MS
  const lo = Math.max(fromMs, earliest)
  const hi = Math.min(toMsValue, latest)
  if (hi < lo) return []

  // ---- index the inputs once, so the per-day loop does no scanning ----
  const rulesByDow = new Map<number, RecurringRule[]>()
  for (const rule of rules) {
    if (rule.status && rule.status !== "active") continue
    const list = rulesByDow.get(rule.day_of_week) ?? []
    list.push(rule)
    rulesByDow.set(rule.day_of_week, list)
  }

  const exceptionsByDay = new Map<string, ExceptionRule[]>()
  for (const exception of exceptions) {
    const key = isoDateKey(exception.date)
    const list = exceptionsByDay.get(key) ?? []
    list.push(exception)
    exceptionsByDay.set(key, list)
  }

  const blocks = existing.map(toBlock).sort((a, b) => a.blockStart - b.blockStart)
  const identical = new Map<string, Block>()
  for (const block of blocks) {
    identical.set(`${block.start}:${block.end}`, block)
  }

  const slots: Slot[] = []
  let scanFrom = 0 // first block that can still overlap (candidates only move forward)

  const lastDay = localDateAt(hi, tz)
  for (
    let day: LocalDate = localDateAt(lo, tz);
    compareLocalDates(day, lastDay) <= 0;
    day = addLocalDays(day, 1)
  ) {
    const dayKey = localDateKey(day)
    const dayExceptions = exceptionsByDay.get(dayKey) ?? []

    if (dayExceptions.some((e) => e.type === "blackout" && !e.start_time && !e.end_time)) {
      continue
    }

    // 1. weekly windows for this local weekday, within their effective dates
    let windows: Minutes[] = []
    for (const rule of rulesByDow.get(dayOfWeekOf(day)) ?? []) {
      if (isoDateKey(rule.effective_from) > dayKey) continue
      if (rule.effective_until && isoDateKey(rule.effective_until) < dayKey) continue
      if (!isValidHHmm(rule.start_time) || !isValidHHmm(rule.end_time)) continue
      windows.push({
        start: hhmmToMinutes(rule.start_time),
        end: hhmmToMinutes(rule.end_time),
      })
    }

    // 2. extra hours add windows; partial blackouts subtract them
    for (const e of dayExceptions) {
      if (!isValidHHmm(e.start_time) || !isValidHHmm(e.end_time)) continue
      const window = { start: hhmmToMinutes(e.start_time), end: hhmmToMinutes(e.end_time) }
      if (e.type === "extra_hours") windows.push(window)
    }
    windows = mergeWindows(windows)
    for (const e of dayExceptions) {
      if (e.type !== "blackout") continue
      if (!isValidHHmm(e.start_time) || !isValidHHmm(e.end_time)) continue
      windows = subtractWindow(windows, {
        start: hhmmToMinutes(e.start_time),
        end: hhmmToMinutes(e.end_time),
      })
    }

    // 3. cut each window into slots, in the resource's timezone
    for (const w of windows) {
      const windowStart = localToUtcMs(day, w.start, tz)
      const windowEnd = localToUtcMs(day, w.end, tz)

      for (
        let start = windowStart;
        start + duration * MINUTE_MS <= windowEnd;
        start += step * MINUTE_MS
      ) {
        if (start < lo || start > hi) continue

        const end = start + duration * MINUTE_MS

        // An identical booking row already exists: join it if it has room and
        // it is the same service. A different service in the same window falls
        // through to the collision check below, which it will fail.
        const same = identical.get(`${start}:${end}`)
        const sameService = !!same && (!productId || !same.productId || same.productId === productId)
        if (same && sameService) {
          const remaining = same.capacity - same.active
          if (remaining > 0) {
            slots.push({
              start: new Date(start),
              end: new Date(end),
              capacity: same.capacity,
              capacity_remaining: remaining,
              appointment_id: same.id,
            })
          }
          continue
        }

        // Otherwise the buffered block must not touch any existing block.
        const candStart = start - before * MINUTE_MS
        const candEnd = end + after * MINUTE_MS
        while (scanFrom < blocks.length && blocks[scanFrom].blockEnd <= candStart) {
          scanFrom++
        }
        let blocked = false
        for (let i = scanFrom; i < blocks.length; i++) {
          if (blocks[i].blockStart >= candEnd) break
          if (blocks[i].blockEnd > candStart) {
            blocked = true
            break
          }
        }
        if (blocked) continue

        slots.push({
          start: new Date(start),
          end: new Date(end),
          capacity,
          capacity_remaining: capacity,
        })

        if (slots.length >= MAX_SLOTS) return slots
      }
    }
  }

  return slots
}

/**
 * Re-checks that exactly this start time is genuinely offered right now.
 * Every reservation goes through it, so a buyer can never book a time that is
 * outside the hours, on a holiday, in the past, inside the notice window, past
 * the horizon, off the slot grid, or inside another booking's buffer - no
 * matter what the client sent.
 */
export const findBookableSlot = (
  input: Omit<ComputeSlotsInput, "from" | "to"> & { start: Date }
): Slot | null => {
  const { start, ...rest } = input
  const slots = computeSlots({ ...rest, from: start, to: start })
  return slots.find((s) => s.start.getTime() === start.getTime()) ?? null
}

/** Validation shared by the create-hours / create-exception paths. */
export const validateWeeklyWindow = (window: {
  day_of_week: number
  start_time: string
  end_time: string
  effective_from?: Date | string
  effective_until?: Date | string | null
}): string | null => {
  if (!Number.isInteger(window.day_of_week) || window.day_of_week < 0 || window.day_of_week > 6) {
    return "day_of_week must be an integer from 0 (Sunday) to 6 (Saturday)"
  }
  if (!isValidHHmm(window.start_time) || !isValidHHmm(window.end_time)) {
    return "start_time and end_time must be in HH:mm (00:00-23:59) format"
  }
  if (hhmmToMinutes(window.start_time) >= hhmmToMinutes(window.end_time)) {
    return "start_time must be before end_time"
  }
  if (
    window.effective_from &&
    window.effective_until &&
    isoDateKey(window.effective_until) < isoDateKey(window.effective_from)
  ) {
    return "effective_until must not be before effective_from"
  }
  return null
}

export const validateException = (exception: {
  type: "blackout" | "extra_hours"
  start_time?: string | null
  end_time?: string | null
}): string | null => {
  const hasStart = exception.start_time != null && exception.start_time !== ""
  const hasEnd = exception.end_time != null && exception.end_time !== ""

  if (exception.type === "extra_hours" && !(hasStart && hasEnd)) {
    return "extra_hours requires both start_time and end_time"
  }
  if (hasStart !== hasEnd) {
    return "start_time and end_time must be provided together (omit both for a whole-day blackout)"
  }
  if (hasStart && hasEnd) {
    if (!isValidHHmm(exception.start_time) || !isValidHHmm(exception.end_time)) {
      return "start_time and end_time must be in HH:mm (00:00-23:59) format"
    }
    if (hhmmToMinutes(exception.start_time as string) >= hhmmToMinutes(exception.end_time as string)) {
      return "start_time must be before end_time"
    }
  }
  return null
}

/** True when two weekly windows on the same weekday overlap. */
export const weeklyWindowsOverlap = (
  a: { start_time: string; end_time: string },
  b: { start_time: string; end_time: string }
): boolean =>
  hhmmToMinutes(a.start_time) < hhmmToMinutes(b.end_time) &&
  hhmmToMinutes(b.start_time) < hhmmToMinutes(a.end_time)
