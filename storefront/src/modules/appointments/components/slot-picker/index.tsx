"use client"

import { addAppointmentToCart, getAppointmentSlots } from "@lib/data/appointments"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { AppointmentResource, AppointmentSlot } from "types/appointment"

const WINDOW_DAYS = 28

const browserZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

const zones = (): string[] => {
  try {
    const fn = (Intl as any).supportedValuesOf
    if (typeof fn === "function") return fn("timeZone") as string[]
  } catch {
    // fall through
  }
  return [browserZone(), "UTC"]
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

const money = (value: number | null, currency: string | null) => {
  if (value === null) return ""
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format(value)
  } catch {
    return String(value)
  }
}

type Props = {
  resource: AppointmentResource
  initialProductId?: string
}

/**
 * Pick a service, a day and a time, then reserve it.
 *
 * Slots come from the server already filtered to what can genuinely be booked and
 * priced exactly as they will be charged. Times are shown in the shopper's own
 * timezone (changeable). Choosing a slot holds it for the resource's hold time
 * while the shopper pays; the hold is taken by the server, never assumed here.
 */
const SlotPicker = ({ resource, initialProductId }: Props) => {
  const router = useRouter()
  const { countryCode } = useParams() as { countryCode: string }

  const service =
    resource.services.find((s) => s.product_id === initialProductId) ?? resource.services[0]

  const [productId, setProductId] = useState(service?.product_id ?? "")
  const selectedService = resource.services.find((s) => s.product_id === productId) ?? service
  const [variantId, setVariantId] = useState(selectedService?.variants?.[0]?.id ?? "")
  // Starts as the resource's zone (identical on server and client) and switches
  // to the shopper's own after mount, so server and client markup agree and
  // hydration does not warn.
  const [tz, setTz] = useState(resource.timezone)
  useEffect(() => {
    setTz(browserZone())
  }, [])
  const [slots, setSlots] = useState<AppointmentSlot[]>([])
  const [currency, setCurrency] = useState<string | null>(null)
  const [holdMinutes, setHoldMinutes] = useState<number | null>(null)
  const [cancelHours, setCancelHours] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [day, setDay] = useState<string | null>(null)
  const [slot, setSlot] = useState<AppointmentSlot | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Bumped to force a reload of the slots (e.g. after a booking attempt failed
  // because someone else took the time).
  const [refreshKey, setRefreshKey] = useState(0)

  // Reload slots when the service/variant changes. A late response from an older
  // request must not overwrite a newer one, hence the cancelled flag.
  useEffect(() => {
    if (!productId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    setSlot(null)

    const from = new Date()
    const to = new Date(from.getTime() + WINDOW_DAYS * 86_400_000)

    getAppointmentSlots({
      resourceId: resource.id,
      productId,
      variantId: variantId || undefined,
      from: from.toISOString(),
      to: to.toISOString(),
      countryCode,
    })
      .then((res) => {
        if (cancelled) return
        setSlots(res.slots)
        setCurrency(res.currency_code)
        setHoldMinutes(res.resource.hold_minutes)
        setCancelHours(res.resource.cancellation_window_hours)
        if (!variantId) setVariantId(res.variant_id)
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
  }, [resource.id, productId, variantId, countryCode, refreshKey])

  const byDay = useMemo(() => {
    const map = new Map<string, AppointmentSlot[]>()
    for (const s of slots) {
      const key = dateKey(s.start, tz)
      const list = map.get(key) ?? []
      list.push(s)
      map.set(key, list)
    }
    return map
  }, [slots, tz])

  const days = useMemo(() => [...byDay.keys()].sort(), [byDay])

  // Keep a valid day selected as slots/timezone change.
  useEffect(() => {
    if (!days.length) setDay(null)
    else if (!day || !byDay.has(day)) setDay(days[0])
  }, [days, byDay, day])

  const daySlots = day ? byDay.get(day) ?? [] : []

  const formProblem = !slot
    ? "Pick a time first."
    : !name.trim()
      ? "Enter your name."
      : !/^\S+@\S+\.\S+$/.test(email.trim())
        ? "Enter a valid email address."
        : null

  const reserve = async () => {
    if (!slot || formProblem || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await addAppointmentToCart({
        countryCode,
        resourceId: resource.id,
        variantId,
        start: slot.start,
        buyer: {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          notes: notes.trim() || null,
        },
      })
      router.push(`/${countryCode}/cart`)
    } catch (err: any) {
      setSubmitError(err?.message || "Could not reserve that time.")
      setSubmitting(false)
      // The slot may have just been taken; refresh what is offered.
      setRefreshKey((k) => k + 1)
    }
  }

  if (!selectedService) {
    return <p className="text-ui-fg-subtle">This resource has no services to book.</p>
  }

  return (
    <div className="flex flex-col gap-10" data-testid="slot-picker">
      {resource.services.length > 1 ? (
        <div className="flex flex-col gap-2">
          <label className="txt-medium-plus" htmlFor="service-select">
            Service
          </label>
          <select
            id="service-select"
            value={productId}
            onChange={(e) => {
              const next = resource.services.find((s) => s.product_id === e.target.value)
              setProductId(e.target.value)
              setVariantId(next?.variants?.[0]?.id ?? "")
            }}
            className="border-ui-border-base w-full max-w-md rounded-md border px-3 py-2"
          >
            {resource.services.map((s) => (
              <option key={s.product_id} value={s.product_id}>
                {s.title} · {s.duration_minutes} min
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {selectedService.variants.length > 1 ? (
        <div className="flex flex-col gap-2">
          <label className="txt-medium-plus" htmlFor="variant-select">
            Option
          </label>
          <select
            id="variant-select"
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
            className="border-ui-border-base w-full max-w-md rounded-md border px-3 py-2"
          >
            {selectedService.variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <label className="txt-medium-plus" htmlFor="tz-select">
          Your timezone
        </label>
        <input
          id="tz-select"
          list="tz-options"
          value={tz}
          onChange={(e) => {
            try {
              new Intl.DateTimeFormat("en-US", { timeZone: e.target.value })
              setTz(e.target.value)
            } catch {
              // ignore partial/invalid input while typing
            }
          }}
          className="border-ui-border-base w-full max-w-md rounded-md border px-3 py-2"
        />
        <datalist id="tz-options">
          {zones().map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
        <p className="text-ui-fg-subtle txt-small">
          {resource.name} is in {resource.timezone}; times below are shown in {tz}.
        </p>
      </div>

      <section aria-label="Pick a day">
        <h2 className="txt-large-plus mb-3">1. Pick a day</h2>
        {loading ? (
          <p className="text-ui-fg-subtle">Loading available times...</p>
        ) : loadError ? (
          <p className="text-ui-fg-error">{loadError}</p>
        ) : !days.length ? (
          <p className="text-ui-fg-subtle">
            No times are available in the next {WINDOW_DAYS} days. Please check back later.
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
                <div className="txt-compact-xsmall opacity-70">
                  {s.capacity > 1 ? `${s.spots_left} left · ` : ""}
                  {money(s.price, currency)}
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {slot ? (
        <section aria-label="Your details" className="flex max-w-xl flex-col gap-4">
          <h2 className="txt-large-plus">3. Your details</h2>
          <input
            placeholder="Full name"
            aria-label="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            autoComplete="name"
            className="border-ui-border-base rounded-md border px-3 py-2"
          />
          <input
            placeholder="Email"
            aria-label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="border-ui-border-base rounded-md border px-3 py-2"
          />
          <input
            placeholder="Phone (optional)"
            aria-label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={40}
            autoComplete="tel"
            className="border-ui-border-base rounded-md border px-3 py-2"
          />
          <textarea
            placeholder="Anything we should know? (optional)"
            aria-label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            rows={3}
            className="border-ui-border-base rounded-md border px-3 py-2"
          />

          <div className="bg-ui-bg-subtle rounded-md p-4">
            <div className="txt-medium-plus">
              {selectedService.title} with {resource.name}
            </div>
            <div className="txt-small">
              {dayLabel(dateKey(slot.start, tz))}, {time(slot.start, tz)} – {time(slot.end, tz)} ({tz})
            </div>
            <div className="txt-medium-plus mt-1">{money(slot.price, currency)}</div>
            {holdMinutes ? (
              <div className="text-ui-fg-subtle txt-small mt-2">
                We&rsquo;ll hold this time for {holdMinutes} minutes while you check out.
              </div>
            ) : null}
            {cancelHours !== null ? (
              <div className="text-ui-fg-subtle txt-small">
                Free cancellation up to {cancelHours} hour{cancelHours === 1 ? "" : "s"} before.
              </div>
            ) : null}
          </div>

          {submitError ? (
            <p className="text-ui-fg-error" role="alert">
              {submitError}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reserve}
            disabled={!!formProblem || submitting}
            className="bg-ui-button-inverted text-ui-fg-on-inverted w-fit rounded-md px-6 py-3 disabled:opacity-50"
            data-testid="reserve-button"
          >
            {submitting ? "Reserving..." : "Continue to checkout"}
          </button>
          {formProblem && (name || email) ? (
            <p className="text-ui-fg-subtle txt-small">{formProblem}</p>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

export default SlotPicker
