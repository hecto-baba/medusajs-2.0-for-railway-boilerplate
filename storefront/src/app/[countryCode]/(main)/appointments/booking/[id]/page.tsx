import { getBooking } from "@lib/data/appointments"
import BookingActions from "@modules/appointments/components/booking-actions"
import Chip from "@modules/common/components/chip"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Metadata } from "next"
import { notFound } from "next/navigation"

export const metadata: Metadata = {
  title: "Your booking",
  // A link carrying a private token must not be indexed or cached by crawlers.
  robots: { index: false, follow: false },
}

const when = (iso: string, timeZone: string | null) => {
  try {
    return new Date(iso).toLocaleString(undefined, {
      timeZone: timeZone ?? undefined,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    })
  } catch {
    return new Date(iso).toLocaleString()
  }
}

/**
 * One booking: its details and, while still allowed, a cancel button. Reached
 * from the link in the confirmation email (signed token, works for guests) or
 * from a signed-in customer's own bookings.
 */
export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string; moved?: string }>
}) {
  const { id } = await params
  const { token, moved } = await searchParams

  const booking = await getBooking(id, token)
  if (!booking) notFound()

  const cancelled = booking.status === "cancelled"
  const tz = booking.resource.timezone

  return (
    <div className="bg-canvas">
    <div className="content-container max-w-2xl py-8 small:py-12" data-testid="booking-page">
      <h1 className="mb-6 font-display text-3xl font-extrabold tracking-tight text-ink">
        {cancelled ? "Booking cancelled" : "Your booking"}
      </h1>

      {moved && !cancelled ? (
        <div className="mb-6 rounded-large bg-success-soft p-4 font-bold text-success" role="status" data-testid="moved-banner">
          Rescheduled. A confirmation email is on its way.
        </div>
      ) : null}

      <div className="mb-6 rounded-large bg-card p-5 shadow-lift">
        <div className="mb-2">
          <Chip tone={cancelled ? "warning" : "success"}>{cancelled ? "Cancelled" : "Confirmed"}</Chip>
        </div>
        <div className="font-display text-xl font-extrabold text-ink">{booking.service.title}</div>
        <div className="text-muted">with {booking.resource.name}</div>
        <div className="mt-3 font-bold text-ink">{when(booking.start_time, tz)}</div>
        {booking.rescheduled_from_start && !cancelled ? (
          <div className="text-sm text-muted">
            Moved from {when(booking.rescheduled_from_start, tz)}
            {booking.rescheduled_by && booking.rescheduled_by !== "buyer" ? " by the business" : ""}
          </div>
        ) : null}
        {tz ? <div className="text-sm text-muted">Times are in {tz}</div> : null}
        {booking.order_id ? (
          <div className="mt-3 text-sm text-muted">Order {booking.order_id}</div>
        ) : null}
        {cancelled ? (
          <div className="mt-3 font-bold text-brand">
            This booking was cancelled
            {booking.cancelled_by === "vendor" ? " by the business" : ""}.
          </div>
        ) : null}
      </div>

      {!cancelled ? (
        <BookingActions
          id={booking.id}
          token={token}
          canCancel={booking.can_cancel}
          canReschedule={booking.can_reschedule}
          reschedulesLeft={booking.reschedules_left}
          deadlineLabel={when(booking.cancel_deadline, tz)}
          windowHours={null}
        />
      ) : null}

      <div className="mt-8">
        <LocalizedClientLink href="/book" className="font-bold text-brand hover:underline">
          Book another appointment
        </LocalizedClientLink>
      </div>
    </div>
    </div>
  )
}
