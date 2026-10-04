import { getBooking } from "@lib/data/appointments"
import ReschedulePicker from "@modules/appointments/components/reschedule-picker"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Metadata } from "next"
import { notFound } from "next/navigation"

export const metadata: Metadata = {
  title: "Change your booking time",
  // A link carrying a private token must not be indexed or cached by crawlers.
  robots: { index: false, follow: false },
}

/**
 * Pick a new time for one booking. Reached from the booking page; the same
 * signed token (guests) or signed-in customer that may view the booking may move
 * it. When the booking can no longer be moved online, this explains instead.
 */
export default async function RescheduleBookingPage({
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

  const back = token ? `/appointments/booking/${id}?token=${encodeURIComponent(token)}` : `/appointments/booking/${id}`

  return (
    <div className="bg-canvas">
    <div className="content-container max-w-3xl py-8 small:py-12" data-testid="reschedule-page">
      <h1 className="mb-6 font-display text-3xl font-extrabold tracking-tight text-ink">Choose a new time</h1>

      {booking.can_reschedule ? (
        <ReschedulePicker
          id={booking.id}
          token={token}
          currentStart={booking.start_time}
          resourceTimezone={booking.resource.timezone ?? "UTC"}
          serviceTitle={booking.service.title ?? "Appointment"}
          resourceName={booking.resource.name ?? "your appointment"}
        />
      ) : (
        <div className="flex flex-col gap-4 rounded-large bg-card p-5 shadow-lift">
          <p className="text-muted">
            {booking.status === "cancelled"
              ? "This booking was cancelled, so it cannot be moved."
              : booking.reschedules_left === 0
                ? "This booking has already been moved the maximum number of times. Please contact the business to change it again."
                : "This booking can no longer be changed online. Please contact the business."}
          </p>
          <LocalizedClientLink href={back} className="font-bold text-brand hover:underline">
            Back to your booking
          </LocalizedClientLink>
        </div>
      )}
    </div>
    </div>
  )
}
