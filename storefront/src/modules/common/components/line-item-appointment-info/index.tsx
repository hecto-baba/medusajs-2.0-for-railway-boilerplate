"use client"

import { Text } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { isAppointmentLineItem } from "types/appointment"

type Props = {
  metadata?: Record<string, unknown> | null
  /** Show the "reserved for you" countdown (cart only, not on a placed order). */
  showHold?: boolean
  "data-testid"?: string
}

const str = (value: unknown): string | null =>
  typeof value === "string" && value ? value : null

const format = (iso: string, timeZone: string | null, withZone: boolean) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  try {
    return date.toLocaleString(undefined, {
      timeZone: timeZone ?? undefined,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      ...(withZone ? { timeZoneName: "short" } : {}),
    })
  } catch {
    return date.toLocaleString()
  }
}

const Countdown = ({ expiresAt }: { expiresAt: string }) => {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const remaining = new Date(expiresAt).getTime() - now

  if (Number.isNaN(remaining)) return null

  if (remaining <= 0) {
    return (
      <Text className="txt-compact-small text-brand mt-0.5" role="alert">
        Your reservation has expired. Remove this and choose the time again.
      </Text>
    )
  }

  const minutes = Math.floor(remaining / 60_000)
  const seconds = Math.floor((remaining % 60_000) / 1000)

  return (
    <Text className="txt-compact-small text-muted mt-0.5">
      Reserved for you: {minutes}:{String(seconds).padStart(2, "0")}
    </Text>
  )
}

/**
 * The booking details of an appointment line (resource, when), shown in the
 * resource's own timezone, with a countdown for the checkout hold. Renders
 * nothing for any other kind of line item.
 */
const LineItemAppointmentInfo = ({
  metadata,
  showHold = false,
  "data-testid": dataTestid,
}: Props) => {
  if (!isAppointmentLineItem(metadata)) return null

  const start = str(metadata?.start_time)
  const end = str(metadata?.end_time)
  const tz = str(metadata?.resource_timezone)
  const resource = str(metadata?.resource_name)
  const holdExpiresAt = str(metadata?.hold_expires_at)

  if (!start) return null

  return (
    <div data-testid={dataTestid}>
      <Text className="inline-block txt-medium text-muted w-full overflow-hidden text-ellipsis">
        {resource ? `${resource} · ` : ""}
        {format(start, tz, true)}
        {end
          ? ` – ${new Date(end).toLocaleTimeString(undefined, {
              timeZone: tz ?? undefined,
              hour: "numeric",
              minute: "2-digit",
            })}`
          : ""}
      </Text>
      {showHold && holdExpiresAt ? <Countdown expiresAt={holdExpiresAt} /> : null}
    </div>
  )
}

export default LineItemAppointmentInfo
