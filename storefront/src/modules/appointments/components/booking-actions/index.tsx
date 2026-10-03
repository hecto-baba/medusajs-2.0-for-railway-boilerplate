"use client"

import { cancelBooking } from "@lib/data/appointments"
import { useRouter } from "next/navigation"
import { useState } from "react"

type Props = {
  id: string
  token?: string
  canCancel: boolean
  deadlineLabel: string
  windowHours: number | null
}

/**
 * Cancel button for a booking, with a confirmation step. Whether cancelling is
 * still allowed is decided by the server (the deadline is enforced there); this
 * only reflects it, so a stale page cannot cancel a booking past its deadline.
 */
const BookingActions = ({ id, token, canCancel, deadlineLabel }: Props) => {
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

  if (!canCancel) {
    return (
      <p className="text-ui-fg-subtle txt-small">
        This booking can no longer be cancelled online. Please contact the business.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-ui-fg-subtle txt-small">You can cancel until {deadlineLabel}.</p>
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
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="w-fit rounded-md border px-4 py-2"
          data-testid="cancel-booking-button"
        >
          Cancel booking
        </button>
      )}
      <p className="text-ui-fg-subtle txt-small">
        Cancelling does not refund your payment automatically; the business will handle any
        refund.
      </p>
    </div>
  )
}

export default BookingActions
