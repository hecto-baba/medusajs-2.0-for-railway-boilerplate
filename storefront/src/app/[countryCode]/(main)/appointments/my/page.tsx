import { listMyBookings } from "@lib/data/appointments"
import Chip from "@modules/common/components/chip"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Metadata } from "next"

export const metadata: Metadata = { title: "My bookings" }

const when = (iso: string, timeZone: string | null) => {
  try {
    return new Date(iso).toLocaleString(undefined, {
      timeZone: timeZone ?? undefined,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    })
  } catch {
    return new Date(iso).toLocaleString()
  }
}

export default async function MyBookingsPage() {
  const result = await listMyBookings({ limit: 50 })

  if (!result) {
    return (
      <div className="bg-canvas">
        <div className="content-container py-8 small:py-12" data-testid="my-bookings-signin">
          <div className="max-w-md rounded-large bg-card p-6 shadow-lift">
            <h1 className="mb-2 font-display text-3xl font-extrabold tracking-tight text-ink">My bookings</h1>
            <p className="mb-4 text-muted">Sign in to see your bookings.</p>
            <LocalizedClientLink
              href="/account"
              className="inline-block rounded-large bg-brand px-5 py-2.5 font-extrabold text-brand-ink hover:opacity-90"
            >
              Sign in
            </LocalizedClientLink>
          </div>
        </div>
      </div>
    )
  }

  const now = Date.now()
  const upcoming = result.bookings.filter(
    (b) => b.status === "confirmed" && new Date(b.end_time).getTime() > now
  )
  const past = result.bookings.filter((b) => !upcoming.includes(b))

  const row = (b: (typeof result.bookings)[number]) => (
    <li key={b.id}>
      <LocalizedClientLink
        href={`/appointments/booking/${b.id}`}
        className="flex flex-wrap items-center justify-between gap-2 rounded-large bg-card p-4 shadow-lift transition-shadow hover:shadow-pop"
      >
        <div>
          <div className="font-bold text-ink">
            {b.service.title} with {b.resource.name}
          </div>
          <div className="text-sm text-muted">{when(b.start_time, b.resource.timezone)}</div>
        </div>
        <span className="flex items-center gap-2">
          {b.rescheduled_from_start && b.status !== "cancelled" ? (
            <Chip tone="muted">Rescheduled</Chip>
          ) : null}
          {b.status === "cancelled" ? (
            <Chip tone="warning">
              {b.cancelled_by === "vendor" || b.cancelled_by === "admin"
                ? "Cancelled by the business"
                : "Cancelled"}
            </Chip>
          ) : (
            <Chip tone={b.can_cancel || b.can_reschedule ? "success" : "muted"}>
              {b.can_cancel || b.can_reschedule ? "Manage" : "View"}
            </Chip>
          )}
        </span>
      </LocalizedClientLink>
    </li>
  )

  return (
    <div className="bg-canvas">
    <div className="content-container max-w-3xl py-8 small:py-12" data-testid="my-bookings">
      <h1 className="mb-8 font-display text-3xl font-extrabold tracking-tight text-ink">My bookings</h1>

      <h2 className="mb-3 font-display text-lg font-extrabold text-ink">Upcoming</h2>
      {upcoming.length ? (
        <ul className="mb-10 flex flex-col gap-3">{upcoming.map(row)}</ul>
      ) : (
        <p className="mb-10 text-muted">
          No upcoming bookings.{" "}
          <LocalizedClientLink href="/book" className="font-bold text-brand hover:underline">
            Book an appointment
          </LocalizedClientLink>
        </p>
      )}

      {past.length ? (
        <>
          <h2 className="mb-3 font-display text-lg font-extrabold text-ink">Past and cancelled</h2>
          <ul className="flex flex-col gap-3">{past.map(row)}</ul>
        </>
      ) : null}
    </div>
    </div>
  )
}
