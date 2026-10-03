import { getBooking } from "@lib/data/appointments"
import BookingActions from "@modules/appointments/components/booking-actions"
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
  searchParams: Promise<{ token?: string }>
}) {
  const { id } = await params
  const { token } = await searchParams

  const booking = await getBooking(id, token)
  if (!booking) notFound()

  const cancelled = booking.status === "cancelled"
  const tz = booking.resource.timezone

  return (
    <div className="content-container max-w-2xl py-12" data-testid="booking-page">
      <h1 className="text-3xl-regular mb-6">
        {cancelled ? "Booking cancelled" : "Your booking"}
      </h1>

      <div className="border-ui-border-base mb-6 rounded-lg border p-5">
        <div className="txt-large-plus">{booking.service.title}</div>
        <div className="text-ui-fg-subtle">with {booking.resource.name}</div>
        <div className="txt-medium-plus mt-3">{when(booking.start_time, tz)}</div>
        {tz ? <div className="text-ui-fg-subtle txt-small">Times are in {tz}</div> : null}
        {booking.order_id ? (
          <div className="text-ui-fg-subtle txt-small mt-3">Order {booking.order_id}</div>
        ) : null}
        {cancelled ? (
          <div className="text-ui-fg-error mt-3">
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
          deadlineLabel={when(booking.cancel_deadline, tz)}
          windowHours={null}
        />
      ) : null}

      <div className="mt-8">
        <LocalizedClientLink href="/book" className="underline">
          Book another appointment
        </LocalizedClientLink>
      </div>
    </div>
  )
}
