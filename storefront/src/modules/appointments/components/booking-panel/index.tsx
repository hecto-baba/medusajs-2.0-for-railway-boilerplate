"use client"

import { addAppointmentToCart, getAppointmentSlots } from "@lib/data/appointments"
import RemoteImage from "../remote-image"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { AppointmentProductOffer, AppointmentSlot } from "types/appointment"

const WINDOW_DAYS = 28
const ANY = "any"

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

const timeOf = (iso: string, timeZone: string) =>
  new Date(iso).toLocaleTimeString(undefined, { timeZone, hour: "numeric", minute: "2-digit" })

const dayParts = (key: string) => {
  const d = new Date(`${key}T12:00:00.000Z`)
  return {
    weekday: d.toLocaleDateString(undefined, { timeZone: "UTC", weekday: "short" }),
    date: d.toLocaleDateString(undefined, { timeZone: "UTC", day: "numeric", month: "short" }),
  }
}

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

type Candidate = { slot: AppointmentSlot; resourceId: string }

const Avatar = ({ name, image }: { name: string; image: string | null }) =>
  image ? (
    <RemoteImage src={image} width={36} height={36} className="h-9 w-9 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-extrabold text-brand">
      {name.charAt(0).toUpperCase()}
    </span>
  )

/**
 * Book an appointment product straight from its product page: who (a specific
 * person, or "Any professional" which takes whoever is free first), a day, a
 * time, then the buyer's details. It puts the booking in the normal cart with the
 * same call the /book pages use, so cart and checkout are unchanged.
 *
 * Slots come from the server already filtered to what can genuinely be booked and
 * priced as they will be charged. The server decides the price and takes the
 * hold; nothing here is assumed.
 */
const BookingPanel = ({ offer }: { offer: AppointmentProductOffer }) => {
  const router = useRouter()
  const { countryCode } = useParams() as { countryCode: string }

  const service = offer.service!
  const resources = offer.resources
  const multiple = resources.length > 1

  const [who, setWho] = useState<string>(multiple ? ANY : resources[0].id)
  const [variantId, setVariantId] = useState(service.variants[0]?.id ?? "")
  // Starts as the first resource's zone (same on server and client) and switches
  // to the shopper's own after mount, so hydration agrees.
  const [tz, setTz] = useState(resources[0].timezone)
  useEffect(() => setTz(browserZone()), [])

  const [slotsBy, setSlotsBy] = useState<Record<string, AppointmentSlot[]>>({})
  const [currency, setCurrency] = useState<string | null>(service.currency_code)
  const [holdMinutes, setHoldMinutes] = useState<number | null>(null)
  const [cancelHours, setCancelHours] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [day, setDay] = useState<string | null>(null)
  const [choice, setChoice] = useState<Candidate | null>(null)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Load every person's times at once. A late answer from an older request must
  // not overwrite a newer one, hence the cancelled flag.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    const from = new Date()
    const to = new Date(from.getTime() + WINDOW_DAYS * 86_400_000)

    Promise.allSettled(
      resources.map((r) =>
        getAppointmentSlots({
          resourceId: r.id,
          productId: service.product_id,
          variantId: variantId || undefined,
          from: from.toISOString(),
          to: to.toISOString(),
          countryCode,
        }).then((res) => ({ id: r.id, res }))
      )
    ).then((results) => {
      if (cancelled) return
      const next: Record<string, AppointmentSlot[]> = {}
      let firstError: string | null = null
      for (let i = 0; i < results.length; i++) {
        const r = results[i]
        if (r.status === "fulfilled") {
          next[r.value.id] = r.value.res.slots
          setCurrency(r.value.res.currency_code ?? service.currency_code)
          setHoldMinutes(r.value.res.resource.hold_minutes)
          setCancelHours(r.value.res.resource.cancellation_window_hours)
          if (!variantId && r.value.res.variant_id) setVariantId(r.value.res.variant_id)
        } else {
          next[resources[i].id] = []
          firstError = firstError ?? (r.reason?.message || "Could not load times.")
        }
      }
      setSlotsBy(next)
      if (firstError && results.every((r) => r.status === "rejected")) setLoadError(firstError)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [resources, service.product_id, service.currency_code, variantId, countryCode, refreshKey])

  // The times on offer for the current choice of person. "Any professional"
  // keeps, for each start time, the first person who is free then.
  const candidates: Candidate[] = useMemo(() => {
    if (who !== ANY) {
      return (slotsBy[who] ?? []).map((slot) => ({ slot, resourceId: who }))
    }
    const byStart = new Map<string, Candidate>()
    for (const r of resources) {
      for (const slot of slotsBy[r.id] ?? []) {
        if (!byStart.has(slot.start)) byStart.set(slot.start, { slot, resourceId: r.id })
      }
    }
    return [...byStart.values()].sort((a, b) => a.slot.start.localeCompare(b.slot.start))
  }, [who, slotsBy, resources])

  const byDay = useMemo(() => {
    const map = new Map<string, Candidate[]>()
    for (const c of candidates) {
      const key = dateKey(c.slot.start, tz)
      map.set(key, [...(map.get(key) ?? []), c])
    }
    return map
  }, [candidates, tz])

  const days = useMemo(() => [...byDay.keys()].sort(), [byDay])

  // Keep a valid day selected as times or the timezone change.
  useEffect(() => {
    if (!days.length) setDay(null)
    else if (!day || !byDay.has(day)) setDay(days[0])
  }, [days, byDay, day])

  const todayKey = dateKey(new Date(), tz)
  const labelFor = (key: string) =>
    key === todayKey ? "Today" : dayParts(key).weekday

  const first = candidates[0]
  const nextText = first
    ? `${dateKey(first.slot.start, tz) === todayKey ? "Today" : dayParts(dateKey(first.slot.start, tz)).date}, ${timeOf(first.slot.start, tz)}`
    : null

  const resourceName = (id: string) => resources.find((r) => r.id === id)?.name || "Staff"
  const durations = [...new Set(resources.map((r) => r.duration_minutes))]
  const durationText =
    who === ANY && durations.length > 1
      ? `${Math.min(...durations)}–${Math.max(...durations)} min`
      : `${resources.find((r) => r.id === who)?.duration_minutes ?? durations[0]} min`

  const formProblem = !choice
    ? "Pick a time first."
    : !name.trim()
      ? "Enter your name."
      : !/^\S+@\S+\.\S+$/.test(email.trim())
        ? "Enter a valid email address."
        : null

  const book = async () => {
    if (!choice || formProblem || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await addAppointmentToCart({
        countryCode,
        resourceId: choice.resourceId,
        variantId,
        start: choice.slot.start,
        buyer: { name: name.trim(), email: email.trim(), phone: phone.trim() || null },
      })
      router.push(`/${countryCode}/cart`)
    } catch (err: any) {
      setSubmitError(err?.message || "Could not reserve that time.")
      setSubmitting(false)
      setChoice(null)
      // The time may have just been taken; show what is still free.
      setRefreshKey((k) => k + 1)
    }
  }

  const daySlots = day ? byDay.get(day) ?? [] : []

  return (
    <div
      className="flex flex-col gap-y-4 rounded-large bg-card p-5 shadow-lift"
      data-testid="booking-panel"
    >
      <div className="flex items-baseline justify-between">
        <span className="font-display text-2xl font-extrabold text-ink">
          {money(choice?.slot.price ?? service.from_price, currency)}
        </span>
        <span className="text-sm text-muted">{durationText}</span>
      </div>

      {service.variants.length > 1 ? (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-bold text-ink" htmlFor="appt-variant">
            Option
          </label>
          <select
            id="appt-variant"
            value={variantId}
            onChange={(e) => {
              setVariantId(e.target.value)
              setChoice(null)
            }}
            className="w-full rounded-rounded border border-line bg-card px-3 py-2.5 text-ink placeholder:text-muted"
          >
            {service.variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {multiple ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm text-muted">Who would you like?</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Who would you like?">
            {[{ id: ANY, name: "Any professional", sub: "Earliest available", image: null as string | null }]
              .concat(
                resources.map((r) => ({
                  id: r.id,
                  name: r.name || "Staff",
                  sub: `${r.duration_minutes} min`,
                  image: r.image_url,
                }))
              )
              .map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={who === opt.id}
                  onClick={() => {
                    setWho(opt.id)
                    setChoice(null)
                  }}
                  className={`flex min-w-[140px] flex-1 items-center gap-2 rounded-[12px] border-[1.5px] px-3 py-2 text-left ${
                    who === opt.id ? "border-brand bg-brand-soft" : "border-line bg-card"
                  }`}
                >
                  {opt.id === ANY ? (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas text-ink">
                      ★
                    </span>
                  ) : (
                    <Avatar name={opt.name} image={opt.image} />
                  )}
                  <span className="flex flex-col">
                    <span className="text-sm font-bold text-ink">{opt.name}</span>
                    <span className="text-xs text-muted">{opt.sub}</span>
                  </span>
                </button>
              ))}
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">Loading available times...</p>
      ) : loadError ? (
        <p className="text-sm text-brand">{loadError}</p>
      ) : !days.length ? (
        <p className="text-sm text-muted">
          No times are available in the next {WINDOW_DAYS} days. Please check back later.
        </p>
      ) : (
        <>
          {nextText ? (
            <div className="rounded-[12px] bg-success-soft px-3 py-2 text-sm text-success">
              Next available: <b>{nextText}</b>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted">Pick a day</span>
            <div className="flex gap-2 overflow-x-auto pb-1" role="list">
              {days.map((d) => (
                <button
                  key={d}
                  type="button"
                  role="listitem"
                  aria-pressed={day === d}
                  onClick={() => {
                    setDay(d)
                    setChoice(null)
                  }}
                  className={`min-w-[64px] shrink-0 rounded-[12px] border-[1.5px] px-2 py-2 text-center text-ink ${
                    day === d
                      ? "border-brand bg-brand-soft"
                      : "border-line bg-card hover:border-brand"
                  }`}
                >
                  <div className="text-sm font-bold">{labelFor(d)}</div>
                  <div className="text-xs text-muted">{dayParts(d).date}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted">Pick a time</span>
            <div className="grid grid-cols-3 gap-2">
              {daySlots.map((c) => (
                <button
                  key={c.slot.start}
                  type="button"
                  aria-pressed={choice?.slot.start === c.slot.start}
                  onClick={() => setChoice(c)}
                  data-testid="slot-button"
                  className={`rounded-[12px] border-[1.5px] px-1 py-2 text-center text-sm font-bold text-ink ${
                    choice?.slot.start === c.slot.start
                      ? "border-brand bg-brand-soft"
                      : "border-line bg-card hover:border-brand"
                  }`}
                >
                  {timeOf(c.slot.start, tz)}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">Times shown in {tz}.</p>
          </div>
        </>
      )}

      {choice ? (
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <div className="text-sm">
            <div className="font-bold text-ink">
              {service.title} with {resourceName(choice.resourceId)}
              {who === ANY ? (
                <span className="ml-2 rounded-circle bg-success-soft px-2 py-0.5 text-xs font-bold text-success">
                  auto-assigned
                </span>
              ) : null}
            </div>
            <div className="text-muted">
              {dayParts(dateKey(choice.slot.start, tz)).weekday},{" "}
              {dayParts(dateKey(choice.slot.start, tz)).date} · {timeOf(choice.slot.start, tz)} –{" "}
              {timeOf(choice.slot.end, tz)}
            </div>
          </div>

          <input
            placeholder="Full name"
            aria-label="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            autoComplete="name"
            className="w-full rounded-rounded border border-line bg-card px-3 py-2.5 text-ink placeholder:text-muted"
          />
          <input
            placeholder="Email"
            aria-label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full rounded-rounded border border-line bg-card px-3 py-2.5 text-ink placeholder:text-muted"
          />
          <input
            placeholder="Phone (optional)"
            aria-label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={40}
            autoComplete="tel"
            className="w-full rounded-rounded border border-line bg-card px-3 py-2.5 text-ink placeholder:text-muted"
          />
        </div>
      ) : null}

      {submitError ? (
        <p className="text-sm text-brand" role="alert">
          {submitError} Please pick another time.
        </p>
      ) : null}

      <button
        type="button"
        onClick={book}
        disabled={!!formProblem || submitting}
        data-testid="reserve-button"
        className="w-full rounded-large bg-brand px-6 py-3 font-extrabold text-brand-ink hover:opacity-90 disabled:opacity-40"
      >
        {submitting ? "Reserving..." : "Book now"}
      </button>
      {choice && formProblem && (name || email) ? (
        <p className="text-sm text-muted">{formProblem}</p>
      ) : null}

      <ul className="flex flex-col gap-1 text-xs text-muted">
        {cancelHours !== null ? (
          <li>
            ✓ Free cancellation up to {cancelHours} hour{cancelHours === 1 ? "" : "s"} before
          </li>
        ) : null}
        {holdMinutes ? <li>✓ Held for {holdMinutes} min while you check out</li> : null}
      </ul>
    </div>
  )
}

export default BookingPanel
