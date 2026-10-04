/**
 * Who may move a booking, and when. Pure, so the API check, the buyer's
 * "can reschedule" flag and the tests all use one rule.
 *
 *  - Only a confirmed booking that has not started can move.
 *  - A buyer may move it until the resource's cancellation deadline, and at most
 *    MAX_BUYER_RESCHEDULES times. The business (vendor / admin / system) has
 *    neither limit.
 */
export const MAX_BUYER_RESCHEDULES = 2

export type RescheduleActor = "buyer" | "vendor" | "admin" | "system"

export type RescheduleCheckInput = {
  actor: RescheduleActor
  attendeeStatus: string
  slotStatus: string
  slotStart: Date | string
  cancellationWindowHours: number
  rescheduleCount: number
  now: Date
}

export type RescheduleCheck = { ok: true } | { ok: false; reason: string }

export const checkReschedule = (input: RescheduleCheckInput): RescheduleCheck => {
  const start = new Date(input.slotStart).getTime()

  if (input.attendeeStatus !== "confirmed") {
    return { ok: false, reason: "Only a confirmed booking can be rescheduled." }
  }
  if (input.slotStatus === "completed" || input.slotStatus === "cancelled") {
    return { ok: false, reason: "This booking can no longer be rescheduled." }
  }
  if (start <= input.now.getTime()) {
    return { ok: false, reason: "This booking has already started." }
  }

  if (input.actor === "buyer") {
    const deadline = start - input.cancellationWindowHours * 3_600_000
    if (input.now.getTime() > deadline) {
      return {
        ok: false,
        reason: "This booking can no longer be changed online. Please contact the business.",
      }
    }
    if (input.rescheduleCount >= MAX_BUYER_RESCHEDULES) {
      return {
        ok: false,
        reason: "This booking has already been rescheduled the maximum number of times. Please contact the business.",
      }
    }
  }

  return { ok: true }
}

export const reschedulesLeft = (rescheduleCount: number): number =>
  Math.max(0, MAX_BUYER_RESCHEDULES - rescheduleCount)
