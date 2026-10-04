import {
  MAX_BUYER_RESCHEDULES,
  checkReschedule,
  reschedulesLeft,
} from "../../src/modules/appointment-booking/lib/reschedule-rules"
import { statusAfterRemoval } from "../../src/workflows/steps/cancel-appointment"

const now = new Date("2030-01-10T09:00:00.000Z")
const base = {
  actor: "buyer" as const,
  attendeeStatus: "confirmed",
  slotStatus: "booked",
  slotStart: new Date("2030-01-12T09:00:00.000Z"), // 48h away
  cancellationWindowHours: 24,
  rescheduleCount: 0,
  now,
}

describe("checkReschedule", () => {
  it("lets a buyer move a confirmed booking before the deadline", () => {
    expect(checkReschedule(base)).toEqual({ ok: true })
  })

  it("refuses a buyer inside the cancellation window", () => {
    const result = checkReschedule({ ...base, slotStart: new Date("2030-01-11T08:00:00.000Z") })
    expect(result.ok).toBe(false)
  })

  it("allows the buyer exactly at the deadline", () => {
    const result = checkReschedule({ ...base, slotStart: new Date("2030-01-11T09:00:00.000Z") })
    expect(result).toEqual({ ok: true })
  })

  it("stops a buyer after the reschedule limit but not the business", () => {
    const used = { ...base, rescheduleCount: MAX_BUYER_RESCHEDULES }
    expect(checkReschedule(used).ok).toBe(false)
    expect(checkReschedule({ ...used, actor: "vendor" })).toEqual({ ok: true })
    expect(checkReschedule({ ...used, actor: "admin" })).toEqual({ ok: true })
  })

  it("lets the business move a booking inside the window, but never a started one", () => {
    const soon = { ...base, actor: "vendor" as const, slotStart: new Date("2030-01-10T10:00:00.000Z") }
    expect(checkReschedule(soon)).toEqual({ ok: true })
    expect(checkReschedule({ ...soon, slotStart: new Date("2030-01-10T08:00:00.000Z") }).ok).toBe(false)
  })

  it("refuses bookings that are not confirmed, or whose slot is finished", () => {
    expect(checkReschedule({ ...base, attendeeStatus: "cancelled" }).ok).toBe(false)
    expect(checkReschedule({ ...base, attendeeStatus: "reserved" }).ok).toBe(false)
    expect(checkReschedule({ ...base, slotStatus: "completed" }).ok).toBe(false)
    expect(checkReschedule({ ...base, slotStatus: "cancelled" }).ok).toBe(false)
  })
})

describe("reschedulesLeft", () => {
  it("counts down and never goes negative", () => {
    expect(reschedulesLeft(0)).toBe(MAX_BUYER_RESCHEDULES)
    expect(reschedulesLeft(MAX_BUYER_RESCHEDULES + 3)).toBe(0)
  })
})

describe("statusAfterRemoval (used by cancel and by moving out of a group slot)", () => {
  const t = new Date("2030-01-10T09:00:00.000Z")
  it("cancels a slot nobody remains in", () => {
    expect(statusAfterRemoval("booked", [], t)).toBe("cancelled")
  })
  it("keeps a group slot booked for the people still confirmed", () => {
    expect(statusAfterRemoval("booked", [{ status: "confirmed" }], t)).toBe("booked")
  })
  it("never reopens a completed slot", () => {
    expect(statusAfterRemoval("completed", [], t)).toBe("completed")
  })
})
