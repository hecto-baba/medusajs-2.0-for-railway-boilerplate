import {
  ComputeSlotsInput,
  ResourceSettings,
  computeSlots,
  findBookableSlot,
  validateException,
  validateWeeklyWindow,
  weeklyWindowsOverlap,
} from "../../src/modules/appointment-booking/lib/availability"
import {
  isValidTimeZone,
  localToUtcMs,
  tzOffsetMinutes,
} from "../../src/modules/appointment-booking/lib/timezone"

// 2030-01-07 is a Monday. Far in the future so "now" never interferes.
const NOW = new Date("2029-12-01T00:00:00.000Z")
const MONDAY = "2030-01-07"

const resource = (over: Partial<ResourceSettings> = {}): ResourceSettings => ({
  timezone: "UTC",
  session_duration_minutes: 15,
  slot_step_minutes: null,
  capacity: 1,
  buffer_before_minutes: 0,
  buffer_after_minutes: 0,
  min_notice_minutes: 0,
  max_advance_days: 730,
  ...over,
})

const weekly = (
  day_of_week: number,
  start_time: string,
  end_time: string,
  extra: Record<string, unknown> = {}
) => ({
  day_of_week,
  start_time,
  end_time,
  effective_from: "2029-01-01T00:00:00.000Z",
  effective_until: null,
  status: "active",
  ...extra,
})

const run = (over: Partial<ComputeSlotsInput> & { day?: string; days?: number } = {}) => {
  const day = over.day ?? MONDAY
  const from = over.from ?? new Date(`${day}T00:00:00.000Z`)
  const to = over.to ?? new Date(`${day}T23:59:59.000Z`)
  return computeSlots({
    resource: resource(),
    offering: null,
    rules: [],
    exceptions: [],
    existing: [],
    now: NOW,
    ...over,
    from,
    to,
  })
}

const iso = (slots: { start: Date }[]) => slots.map((s) => s.start.toISOString())

describe("computeSlots", () => {
  it("generates 28 slots x 2 seats for 15-min sessions, 9-13 and 14-17", () => {
    const slots = run({
      resource: resource({ capacity: 2 }),
      rules: [weekly(1, "09:00", "13:00"), weekly(1, "14:00", "17:00")],
    })

    expect(slots).toHaveLength(28)
    expect(slots.every((s) => s.capacity === 2 && s.capacity_remaining === 2)).toBe(true)
    expect(iso(slots)[0]).toBe("2030-01-07T09:00:00.000Z")
    expect(iso(slots)[15]).toBe("2030-01-07T12:45:00.000Z")
    expect(iso(slots)[16]).toBe("2030-01-07T14:00:00.000Z") // lunch gap
    expect(iso(slots)[27]).toBe("2030-01-07T16:45:00.000Z")
  })

  it("applies weekly hours in the resource's timezone (New York, winter and summer)", () => {
    const rules = [weekly(1, "09:00", "10:00")]
    const ny = resource({ timezone: "America/New_York", session_duration_minutes: 60 })

    const winter = run({ resource: ny, rules, day: "2030-01-07" })
    expect(iso(winter)).toEqual(["2030-01-07T14:00:00.000Z"]) // EST = UTC-5

    const summer = run({ resource: ny, rules, day: "2030-07-08" })
    expect(iso(summer)).toEqual(["2030-07-08T13:00:00.000Z"]) // EDT = UTC-4
  })

  it("keeps 09:00 local across the spring-forward change (Sunday 2030-03-10)", () => {
    const rules = [weekly(0, "09:00", "10:00")]
    const ny = resource({ timezone: "America/New_York", session_duration_minutes: 60 })

    expect(iso(run({ resource: ny, rules, day: "2030-03-03" }))).toEqual([
      "2030-03-03T14:00:00.000Z",
    ])
    expect(iso(run({ resource: ny, rules, day: "2030-03-10" }))).toEqual([
      "2030-03-10T13:00:00.000Z",
    ])
  })

  it("uses the LOCAL weekday, not the UTC weekday", () => {
    // Tokyo is UTC+9: 08:00-09:00 local Tuesday is Monday 23:00-24:00 UTC.
    const slots = run({
      resource: resource({ timezone: "Asia/Tokyo", session_duration_minutes: 60 }),
      rules: [weekly(2, "08:00", "09:00")],
      from: new Date("2030-01-07T00:00:00.000Z"),
      to: new Date("2030-01-08T23:59:59.000Z"),
    })
    expect(iso(slots)).toEqual(["2030-01-07T23:00:00.000Z"])
  })

  it("removes a whole day for a blackout", () => {
    const slots = run({
      rules: [weekly(1, "09:00", "10:00")],
      exceptions: [{ date: `${MONDAY}T00:00:00.000Z`, type: "blackout" }],
    })
    expect(slots).toHaveLength(0)
  })

  it("loads a same-day blackout even when the range starts mid-day", () => {
    const slots = run({
      rules: [weekly(1, "09:00", "17:00")],
      exceptions: [{ date: `${MONDAY}T00:00:00.000Z`, type: "blackout" }],
      from: new Date("2030-01-07T12:00:00.000Z"),
      to: new Date("2030-01-07T23:59:59.000Z"),
    })
    expect(slots).toHaveLength(0)
  })

  it("removes only the window for a partial blackout", () => {
    const slots = run({
      resource: resource({ session_duration_minutes: 60 }),
      rules: [weekly(1, "09:00", "12:00")],
      exceptions: [
        { date: `${MONDAY}T00:00:00.000Z`, type: "blackout", start_time: "10:00", end_time: "11:00" },
      ],
    })
    expect(iso(slots)).toEqual(["2030-01-07T09:00:00.000Z", "2030-01-07T11:00:00.000Z"])
  })

  it("adds slots for extra hours on a normally closed day", () => {
    const slots = run({
      resource: resource({ session_duration_minutes: 60 }),
      rules: [weekly(1, "09:00", "10:00")],
      exceptions: [
        { date: "2030-01-08T00:00:00.000Z", type: "extra_hours", start_time: "10:00", end_time: "12:00" },
      ],
      from: new Date("2030-01-08T00:00:00.000Z"),
      to: new Date("2030-01-08T23:59:59.000Z"),
    })
    expect(iso(slots)).toEqual(["2030-01-08T10:00:00.000Z", "2030-01-08T11:00:00.000Z"])
  })

  it("ignores inactive rules and rules outside their effective dates", () => {
    const slots = run({
      rules: [
        weekly(1, "09:00", "10:00", { status: "inactive" }),
        weekly(1, "10:00", "11:00", { effective_until: "2030-01-01T00:00:00.000Z" }),
        weekly(1, "11:00", "12:00", { effective_from: "2030-02-01T00:00:00.000Z" }),
      ],
    })
    expect(slots).toHaveLength(0)
  })

  it("steps by slot_step_minutes and drops slots that overrun the window", () => {
    const slots = run({
      resource: resource({ session_duration_minutes: 45, slot_step_minutes: 30 }),
      rules: [weekly(1, "09:00", "11:00")],
    })
    // 09:00-09:45, 09:30-10:15, 10:00-10:45; 10:30-11:15 overruns.
    expect(iso(slots)).toEqual([
      "2030-01-07T09:00:00.000Z",
      "2030-01-07T09:30:00.000Z",
      "2030-01-07T10:00:00.000Z",
    ])
  })

  it("lets an offering override duration and capacity", () => {
    const slots = run({
      resource: resource({ session_duration_minutes: 15, capacity: 1 }),
      offering: { duration_minutes: 30, capacity: 3 },
      rules: [weekly(1, "09:00", "10:00")],
    })
    expect(slots).toHaveLength(2)
    expect(slots[0].end.getTime() - slots[0].start.getTime()).toBe(30 * 60_000)
    expect(slots[0].capacity).toBe(3)
  })

  describe("bookings and buffers", () => {
    const hours = [weekly(1, "09:00", "10:00")]
    const existing = (over: Record<string, unknown> = {}) => ({
      id: "appt_1",
      start_time: "2030-01-07T09:15:00.000Z",
      end_time: "2030-01-07T09:30:00.000Z",
      max_capacity: 1,
      active_attendees: 1,
      ...over,
    })

    it("hides a full slot", () => {
      const slots = run({ rules: hours, existing: [existing()] })
      expect(iso(slots)).toEqual([
        "2030-01-07T09:00:00.000Z",
        "2030-01-07T09:30:00.000Z",
        "2030-01-07T09:45:00.000Z",
      ])
    })

    it("keeps a group slot open while it has room, and reports remaining seats", () => {
      const slots = run({
        rules: hours,
        existing: [existing({ max_capacity: 2, active_attendees: 1 })],
      })
      const open = slots.find((s) => s.start.toISOString() === "2030-01-07T09:15:00.000Z")
      expect(open).toBeDefined()
      expect(open!.capacity_remaining).toBe(1)
      expect(open!.appointment_id).toBe("appt_1")

      const full = run({
        rules: hours,
        existing: [existing({ max_capacity: 2, active_attendees: 2 })],
      })
      expect(iso(full)).not.toContain("2030-01-07T09:15:00.000Z")
    })

    it("applies the booking's own buffer to neighbouring slots", () => {
      // Booking 09:15-09:30 with 15 min after => blocks 09:15-09:45.
      const slots = run({
        rules: hours,
        existing: [existing({ buffer_after_minutes: 15 })],
      })
      // 09:00 is still offered because the resource itself has no buffer-after;
      // 09:30 is inside the booking's buffer; 09:45 is the first clean slot.
      expect(iso(slots)).toEqual(["2030-01-07T09:00:00.000Z", "2030-01-07T09:45:00.000Z"])
    })

    it("applies the resource's buffer to candidate slots", () => {
      // Resource buffer-after 15: a 09:00-09:15 slot would run into the 09:15
      // booking's start, so it is not offered; 09:45 is the first clean slot.
      const slots = run({
        resource: resource({ buffer_after_minutes: 15 }),
        rules: hours,
        existing: [existing({ buffer_after_minutes: 15 })],
      })
      expect(iso(slots)).toEqual(["2030-01-07T09:45:00.000Z"])
    })

    it("blocks candidates that overlap a longer existing booking", () => {
      const slots = run({
        resource: resource({ session_duration_minutes: 30 }),
        rules: [weekly(1, "09:00", "11:00")],
        existing: [
          existing({
            start_time: "2030-01-07T09:00:00.000Z",
            end_time: "2030-01-07T10:00:00.000Z",
          }),
        ],
      })
      expect(iso(slots)).toEqual(["2030-01-07T10:00:00.000Z", "2030-01-07T10:30:00.000Z"])
    })
  })

  describe("notice and horizon", () => {
    it("drops slots inside the minimum-notice window", () => {
      const slots = run({
        resource: resource({ min_notice_minutes: 60 }),
        rules: [weekly(1, "09:00", "10:00")],
        now: new Date("2030-01-07T08:30:00.000Z"),
      })
      // earliest = 09:30
      expect(iso(slots)).toEqual(["2030-01-07T09:30:00.000Z", "2030-01-07T09:45:00.000Z"])
    })

    it("drops slots beyond max_advance_days", () => {
      const slots = run({
        resource: resource({ max_advance_days: 3 }),
        rules: [weekly(1, "09:00", "10:00")],
        now: new Date("2030-01-01T00:00:00.000Z"),
      })
      expect(slots).toHaveLength(0)
    })

    it("returns nothing for past slots", () => {
      const slots = run({
        rules: [weekly(1, "09:00", "10:00")],
        now: new Date("2030-01-07T23:00:00.000Z"),
      })
      expect(slots).toHaveLength(0)
    })
  })

  it("rejects ranges longer than 62 days", () => {
    expect(() =>
      run({
        from: new Date("2030-01-01T00:00:00.000Z"),
        to: new Date("2030-04-01T00:00:00.000Z"),
      })
    ).toThrow(RangeError)
  })

  it("returns [] when to is before from", () => {
    expect(
      run({
        from: new Date("2030-01-08T00:00:00.000Z"),
        to: new Date("2030-01-07T00:00:00.000Z"),
      })
    ).toEqual([])
  })
})

describe("findBookableSlot", () => {
  const base = {
    resource: resource({ session_duration_minutes: 30 }),
    offering: null,
    rules: [weekly(1, "09:00", "11:00")],
    exceptions: [],
    existing: [],
    now: NOW,
  }

  it("accepts a genuinely offered start", () => {
    const slot = findBookableSlot({ ...base, start: new Date("2030-01-07T09:30:00.000Z") })
    expect(slot).not.toBeNull()
  })

  it("rejects off-grid, out-of-hours, past and holiday starts", () => {
    expect(findBookableSlot({ ...base, start: new Date("2030-01-07T09:10:00.000Z") })).toBeNull()
    expect(findBookableSlot({ ...base, start: new Date("2030-01-07T11:00:00.000Z") })).toBeNull()
    expect(
      findBookableSlot({ ...base, start: new Date("2030-01-07T09:30:00.000Z"), now: new Date("2030-02-01T00:00:00.000Z") })
    ).toBeNull()
    expect(
      findBookableSlot({
        ...base,
        exceptions: [{ date: "2030-01-07T00:00:00.000Z", type: "blackout" }],
        start: new Date("2030-01-07T09:30:00.000Z"),
      })
    ).toBeNull()
  })
})

describe("validation", () => {
  it("validates weekly windows", () => {
    expect(validateWeeklyWindow({ day_of_week: 1, start_time: "09:00", end_time: "17:00" })).toBeNull()
    expect(validateWeeklyWindow({ day_of_week: 7, start_time: "09:00", end_time: "17:00" })).toMatch(/day_of_week/)
    expect(validateWeeklyWindow({ day_of_week: 1, start_time: "9:00", end_time: "17:00" })).toMatch(/HH:mm/)
    expect(validateWeeklyWindow({ day_of_week: 1, start_time: "17:00", end_time: "09:00" })).toMatch(/before/)
    expect(
      validateWeeklyWindow({
        day_of_week: 1,
        start_time: "09:00",
        end_time: "17:00",
        effective_from: "2030-02-01T00:00:00.000Z",
        effective_until: "2030-01-01T00:00:00.000Z",
      })
    ).toMatch(/effective_until/)
  })

  it("validates exceptions", () => {
    expect(validateException({ type: "blackout" })).toBeNull()
    expect(validateException({ type: "blackout", start_time: "10:00", end_time: "11:00" })).toBeNull()
    expect(validateException({ type: "blackout", start_time: "10:00" })).toMatch(/together/)
    expect(validateException({ type: "extra_hours" })).toMatch(/requires/)
    expect(validateException({ type: "extra_hours", start_time: "11:00", end_time: "10:00" })).toMatch(/before/)
  })

  it("detects overlapping weekly windows", () => {
    expect(weeklyWindowsOverlap({ start_time: "09:00", end_time: "12:00" }, { start_time: "11:00", end_time: "13:00" })).toBe(true)
    expect(weeklyWindowsOverlap({ start_time: "09:00", end_time: "12:00" }, { start_time: "12:00", end_time: "13:00" })).toBe(false)
  })
})

describe("timezone helpers", () => {
  it("validates IANA zones", () => {
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true)
    expect(isValidTimeZone("Not/AZone")).toBe(false)
    expect(isValidTimeZone("")).toBe(false)
  })

  it("computes offsets", () => {
    expect(tzOffsetMinutes(Date.UTC(2030, 0, 7, 12), "Asia/Kolkata")).toBe(330)
    expect(tzOffsetMinutes(Date.UTC(2030, 0, 7, 12), "America/New_York")).toBe(-300)
    expect(tzOffsetMinutes(Date.UTC(2030, 6, 8, 12), "America/New_York")).toBe(-240)
  })

  it("converts local wall time to UTC", () => {
    expect(localToUtcMs({ year: 2030, month: 1, day: 7 }, 9 * 60, "Asia/Kolkata")).toBe(
      Date.UTC(2030, 0, 7, 3, 30)
    )
  })
})
