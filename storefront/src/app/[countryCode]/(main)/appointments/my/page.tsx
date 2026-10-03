import { listMyBookings } from "@lib/data/appointments"
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
      <div className="content-container py-12" data-testid="my-bookings-signin">
        <h1 className="text-3xl-regular mb-4">My bookings</h1>
        <p className="text-ui-fg-subtle mb-4">Sign in to see your bookings.</p>
        <LocalizedClientLink href="/account" className="underline">
          Sign in
        </LocalizedClientLink>
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
        className="border-ui-border-base hover:bg-ui-bg-base-hover flex flex-wrap items-center justify-between gap-2 rounded-lg border p-4"
      >
        <div>
          <div className="txt-medium-plus">
            {b.service.title} with {b.resource.name}
          </div>
          <div className="text-ui-fg-subtle txt-small">{when(b.start_time, b.resource.timezone)}</div>
        </div>
        <span
          className={`txt-small ${b.status === "cancelled" ? "text-ui-fg-error" : "text-ui-fg-subtle"}`}
        >
          {b.status === "cancelled" ? "Cancelled" : b.can_cancel ? "Manage" : "View"}
        </span>
      </LocalizedClientLink>
    </li>
  )

  return (
    <div className="content-container max-w-3xl py-12" data-testid="my-bookings">
      <h1 className="text-3xl-regular mb-8">My bookings</h1>

      <h2 className="txt-large-plus mb-3">Upcoming</h2>
      {upcoming.length ? (
        <ul className="mb-10 flex flex-col gap-3">{upcoming.map(row)}</ul>
      ) : (
        <p className="text-ui-fg-subtle mb-10">
          No upcoming bookings.{" "}
          <LocalizedClientLink href="/book" className="underline">
            Book an appointment
          </LocalizedClientLink>
        </p>
      )}

      {past.length ? (
        <>
          <h2 className="txt-large-plus mb-3">Past and cancelled</h2>
          <ul className="flex flex-col gap-3">{past.map(row)}</ul>
        </>
      ) : null}
    </div>
  )
}
