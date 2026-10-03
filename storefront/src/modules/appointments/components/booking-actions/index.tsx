"use client"

import { cancelBooking } from "@lib/data/appointments"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useRouter } from "next/navigation"
import { useState } from "react"

type Props = {
  id: string
  token?: string
  canCancel: boolean
  canReschedule: boolean
  reschedulesLeft: number
  deadlineLabel: string
  windowHours: number | null
  /** Business contact, shown when the booking can no longer be changed online. */
  contact?: string | null
}

/**
 * Reschedule and cancel for a booking. Whether either is still allowed is
 * decided by the server (the deadline and the reschedule limit are enforced
 * there); this only reflects it, so a stale page cannot change a booking past its
 * deadline. Cancel keeps its confirmation step; Reschedule opens a time picker.
 */
const BookingActions = ({
  id,
  token,
  canCancel,
  canReschedule,
  reschedulesLeft,
  deadlineLabel,
  contact,
}: Props) => {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      await cancelBooking({ id, token })
      router.refresh()
    } catch (e: any) {
      setError(e?.message || "Could not cancel this booking.")
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  if (!canCancel && !canReschedule) {
    return (
      <p className="text-ui-fg-subtle txt-small">
        This booking can no longer be changed online. Please contact the business
        {contact ? <> on {contact}</> : null}.
      </p>
    )
  }

  const rescheduleHref = `/appointments/booking/${id}/reschedule${
    token ? `?token=${encodeURIComponent(token)}` : ""
  }`

  return (
    <div className="flex flex-col gap-3">
      <p className="text-ui-fg-subtle txt-small">
        You can change or cancel until {deadlineLabel}.
      </p>
      {error ? (
        <p className="text-ui-fg-error" role="alert">
          {error}
        </p>
      ) : null}

      {confirming ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="txt-small">Cancel this booking? This cannot be undone.</span>
          <button
            type="button"
            onClick={run}
            disabled={busy}
            className="bg-ui-button-danger rounded-md px-4 py-2 text-white disabled:opacity-50"
          >
            {busy ? "Cancelling..." : "Yes, cancel"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="rounded-md border px-4 py-2"
          >
            Keep it
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {canReschedule ? (
            <LocalizedClientLink
              href={rescheduleHref}
              className="bg-ui-button-inverted text-ui-fg-on-inverted w-fit rounded-md px-4 py-2"
              data-testid="reschedule-booking-button"
            >
              Reschedule
            </LocalizedClientLink>
          ) : null}
          {canCancel ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="w-fit rounded-md border px-4 py-2"
              data-testid="cancel-booking-button"
            >
              Cancel booking
            </button>
          ) : null}
        </div>
      )}

      {canReschedule ? (
        <p className="text-ui-fg-subtle txt-small">
          You have {reschedulesLeft} reschedule{reschedulesLeft === 1 ? "" : "s"} left for this
          booking.
        </p>
      ) : null}
      <p className="text-ui-fg-subtle txt-small">
        Cancelling does not refund your payment automatically; the business will handle any
        refund.
      </p>
    </div>
  )
}

export default BookingActions
