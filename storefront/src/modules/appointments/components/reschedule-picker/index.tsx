"use client"

import { getRescheduleSlots, rescheduleBooking } from "@lib/data/appointments"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { RescheduleSlot } from "types/appointment"

const WINDOW_DAYS = 28

const browserZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

const dateKey = (iso: string | Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso))

const time = (iso: string, timeZone: string) =>
  new Date(iso).toLocaleTimeString(undefined, { timeZone, hour: "numeric", minute: "2-digit" })

const dayLabel = (key: string) =>
  new Date(`${key}T12:00:00.000Z`).toLocaleDateString(undefined, {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  })

const fullWhen = (iso: string, timeZone: string) =>
  new Date(iso).toLocaleString(undefined, {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })

type Props = {
  id: string
  token?: string
  /** The booking's current start, shown struck through. */
  currentStart: string
  resourceTimezone: string
  serviceTitle: string
  resourceName: string
}

/**
 * Pick a new day and time for an existing booking. Same service, same resource,
 * same price - so there are no buyer details and no prices here, only times.
 * What is offered comes from the server (never includes the current time); the
 * move itself is re-checked there, so a stale page cannot take a time that was
 * just booked.
 */
const ReschedulePicker = ({
  id,
  token,
  currentStart,
  resourceTimezone,
  serviceTitle,
  resourceName,
}: Props) => {
  const router = useRouter()
  const { countryCode } = useParams() as { countryCode: string }

  // Starts as the resource's zone (identical on server and client) and switches
  // to the shopper's own after mount, so hydration does not warn.
  const [tz, setTz] = useState(resourceTimezone)
  useEffect(() => {
    setTz(browserZone())
  }, [])

  const [slots, setSlots] = useState<RescheduleSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [day, setDay] = useState<string | null>(null)
  const [slot, setSlot] = useState<RescheduleSlot | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    setSlot(null)

    const from = new Date()
    const to = new Date(from.getTime() + WINDOW_DAYS * 86_400_000)

    getRescheduleSlots({ id, token, from: from.toISOString(), to: to.toISOString() })
      .then((res) => {
        if (!cancelled) setSlots(res.slots)
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message || "Could not load times.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id, token, refreshKey])

  const byDay = useMemo(() => {
    const map = new Map<string, RescheduleSlot[]>()
    for (const s of slots) {
      const key = dateKey(s.start, tz)
      const list = map.get(key) ?? []
      list.push(s)
      map.set(key, list)
    }
    return map
  }, [slots, tz])

  const days = useMemo(() => [...byDay.keys()].sort(), [byDay])

  useEffect(() => {
    if (!days.length) setDay(null)
    else if (!day || !byDay.has(day)) setDay(days[0])
  }, [days, byDay, day])

  const daySlots = day ? byDay.get(day) ?? [] : []

  const confirm = async () => {
    if (!slot || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await rescheduleBooking({ id, token, start: slot.start })
      const query = new URLSearchParams({ moved: "1" })
      if (token) query.set("token", token)
      router.push(`/${countryCode}/appointments/booking/${id}?${query.toString()}`)
      router.refresh()
    } catch (err: any) {
      setSubmitError(
        err?.message
          ? `${err.message} Your original booking is unchanged.`
          : "Could not move your booking. Your original booking is unchanged."
      )
      setSubmitting(false)
      // The time may have just been taken; refresh what is offered.
      setRefreshKey((k) => k + 1)
    }
  }

  const backQuery = token ? `?token=${encodeURIComponent(token)}` : ""

  return (
    <div className="flex flex-col gap-8" data-testid="reschedule-picker">
      <div className="border-ui-border-base flex flex-col gap-1 rounded-lg border p-5">
        <div className="text-ui-fg-subtle txt-small">Current booking</div>
        <div className="txt-large-plus">
          {serviceTitle} with {resourceName}
        </div>
        <div className="text-ui-fg-muted line-through">{fullWhen(currentStart, tz)}</div>
        <div className="text-ui-fg-subtle txt-small">Times are shown in {tz}</div>
      </div>

      <section aria-label="Pick a day">
        <h2 className="txt-large-plus mb-3">1. Pick a day</h2>
        {loading ? (
          <p className="text-ui-fg-subtle">Loading available times...</p>
        ) : loadError ? (
          <p className="text-ui-fg-error">{loadError}</p>
        ) : !days.length ? (
          <p className="text-ui-fg-subtle">
            No other times are available in the next {WINDOW_DAYS} days. Please check back later or
            contact the business.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2" role="list">
            {days.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDay(d)
                  setSlot(null)
                }}
                aria-pressed={day === d}
                className={`rounded-md border px-3 py-2 text-left ${
                  day === d
                    ? "bg-ui-button-inverted text-ui-fg-on-inverted"
                    : "border-ui-border-base hover:bg-ui-bg-base-hover"
                }`}
              >
                <div className="txt-compact-small-plus">{dayLabel(d)}</div>
                <div className="txt-compact-xsmall opacity-70">
                  {byDay.get(d)?.length} time{byDay.get(d)?.length === 1 ? "" : "s"}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {day ? (
        <section aria-label="Pick a time">
          <h2 className="txt-large-plus mb-3">2. Pick a time — {dayLabel(day)}</h2>
          <div className="grid grid-cols-2 gap-2 small:grid-cols-4 medium:grid-cols-6">
            {daySlots.map((s) => (
              <button
                key={s.start}
                type="button"
                onClick={() => setSlot(s)}
                aria-pressed={slot?.start === s.start}
                data-testid="slot-button"
                className={`rounded-md border px-3 py-2 ${
                  slot?.start === s.start
                    ? "bg-ui-button-inverted text-ui-fg-on-inverted"
                    : "border-ui-border-base hover:bg-ui-bg-base-hover"
                }`}
              >
                <div className="txt-compact-small-plus">{time(s.start, tz)}</div>
                {s.capacity > 1 ? (
                  <div className="txt-compact-xsmall opacity-70">{s.spots_left} left</div>
                ) : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {slot ? (
        <div className="bg-ui-bg-subtle flex max-w-xl flex-col gap-1 rounded-md p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ui-fg-muted line-through">{fullWhen(currentStart, tz)}</span>
            <span aria-hidden>to</span>
            <strong>{fullWhen(slot.start, tz)}</strong>
          </div>
          <div className="text-ui-fg-subtle txt-small">
            Same service, same price. You will not be charged again.
          </div>
          <div className="text-ui-fg-subtle txt-small">
            Your cancellation deadline moves with the new time.
          </div>
        </div>
      ) : null}

      {submitError ? (
        <p className="text-ui-fg-error" role="alert">
          {submitError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={confirm}
          disabled={!slot || submitting}
          className="bg-ui-button-inverted text-ui-fg-on-inverted w-fit rounded-md px-6 py-3 disabled:opacity-50"
          data-testid="confirm-reschedule-button"
        >
          {submitting ? "Moving..." : "Confirm new time"}
        </button>
        <a
          href={`/${countryCode}/appointments/booking/${id}${backQuery}`}
          className="underline"
        >
          Keep current time
        </a>
      </div>
    </div>
  )
}

export default ReschedulePicker
