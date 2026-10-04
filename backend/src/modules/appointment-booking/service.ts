import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import { Provider } from "./models/provider"
import { RecurringAvailability } from "./models/recurring-availability"
import { AvailabilityException } from "./models/availability-exception"
import { ServiceProvider } from "./models/service-provider"
import { Appointment } from "./models/appointment"
import { AppointmentAttendee } from "./models/appointment-attendee"
import { PricingRule } from "./models/pricing-rule"
import {
  ExistingAppointment,
  OfferingOverrides,
  ResourceSettings,
  Slot,
  computeSlots,
  findBookableSlot,
} from "./lib/availability"

type TimeWindow = { start: Date; end: Date }

const DAY_MS = 86_400_000
// Exceptions are stored as UTC midnight of a calendar date, and a local day can
// start up to a day away from the UTC day, so the lookup is padded.
const EXCEPTION_PAD_MS = 2 * DAY_MS
// A booking's buffered block can extend up to 24h (the max buffer) past it.
const BOOKING_PAD_MS = 2 * DAY_MS

/** A reserved hold whose expiry has passed no longer occupies a place. */
export const isLiveAttendee = (
  attendee: { status: string; expires_at?: Date | string | null },
  now: Date
): boolean => {
  if (attendee.status === "confirmed") return true
  if (attendee.status !== "reserved") return false
  if (!attendee.expires_at) return true
  return new Date(attendee.expires_at).getTime() > now.getTime()
}

type ProviderRow = {
  id: string
  timezone: string
  session_duration_minutes: number
  slot_step_minutes: number | null
  capacity: number
  buffer_before_minutes: number
  buffer_after_minutes: number
  min_notice_minutes: number
  max_advance_days: number
}

export const toResourceSettings = (p: ProviderRow): ResourceSettings => ({
  timezone: p.timezone,
  session_duration_minutes: p.session_duration_minutes,
  slot_step_minutes: p.slot_step_minutes,
  capacity: p.capacity,
  buffer_before_minutes: p.buffer_before_minutes,
  buffer_after_minutes: p.buffer_after_minutes,
  min_notice_minutes: p.min_notice_minutes,
  max_advance_days: p.max_advance_days,
})

class AppointmentBookingModuleService extends MedusaService({
  Provider,
  RecurringAvailability,
  AvailabilityException,
  ServiceProvider,
  Appointment,
  AppointmentAttendee,
  PricingRule,
}) {
  async countActiveAttendees(appointment_id: string) {
    const [, count] = await this.listAndCountAppointmentAttendees({
      appointment_id,
      status: ["reserved", "confirmed"],
    })

    return count
  }

  /**
   * Everything the engine needs for one resource and one date range, fetched
   * in a fixed number of queries regardless of how much data exists (resource,
   * offering, weekly rules, exceptions, bookings, and one query for every
   * booking's attendees - never one query per booking).
   *
   * `take: null` is deliberate on every list: Medusa's list methods return only
   * the first 15 rows by default, which would silently truncate rules,
   * exceptions and bookings and show slots that are actually taken.
   */
  async loadAvailabilityContext(
    provider_id: string,
    from: Date,
    to: Date,
    product_id?: string | null,
    now: Date = new Date(),
    // A booking being moved must not block its own new time. Used only when the
    // slot being left holds nobody else (see the reschedule step).
    ignore_appointment_id?: string | null
  ) {
    const [providers, rules, exceptions, allAppointments, offerings] = await Promise.all([
      this.listProviders({ id: provider_id }, { take: 1 }),
      this.listRecurringAvailabilities(
        { provider_id, status: "active" },
        { take: null }
      ),
      this.listAvailabilityExceptions(
        {
          provider_id,
          date: {
            $gte: new Date(from.getTime() - EXCEPTION_PAD_MS),
            $lte: new Date(to.getTime() + EXCEPTION_PAD_MS),
          },
        },
        { take: null }
      ),
      this.listAppointments(
        {
          provider_id,
          status: ["available", "booked"],
          start_time: { $lt: new Date(to.getTime() + BOOKING_PAD_MS) },
          end_time: { $gt: new Date(from.getTime() - BOOKING_PAD_MS) },
        },
        { take: null }
      ),
      product_id
        ? this.listServiceProviders(
            { provider_id, service_product_id: product_id },
            { take: 1 }
          )
        : Promise.resolve([]),
    ])

    const provider = providers[0]
    if (!provider) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Resource not found.")
    }

    const appointments = ignore_appointment_id
      ? allAppointments.filter((a) => a.id !== ignore_appointment_id)
      : allAppointments

    const attendees = appointments.length
      ? await this.listAppointmentAttendees(
          {
            appointment_id: appointments.map((a) => a.id),
            status: ["reserved", "confirmed"],
          },
          { take: null, select: ["id", "appointment_id", "status", "expires_at"] }
        )
      : []

    const activeByAppointment = new Map<string, number>()
    for (const attendee of attendees) {
      if (!isLiveAttendee(attendee, now)) continue
      activeByAppointment.set(
        attendee.appointment_id,
        (activeByAppointment.get(attendee.appointment_id) ?? 0) + 1
      )
    }

    const existing: ExistingAppointment[] = appointments.map((a) => ({
      id: a.id,
      start_time: a.start_time,
      end_time: a.end_time,
      block_start: a.block_start,
      block_end: a.block_end,
      buffer_before_minutes: a.buffer_before_minutes,
      buffer_after_minutes: a.buffer_after_minutes,
      max_capacity: a.max_capacity,
      service_product_id: a.service_product_id,
      active_attendees: activeByAppointment.get(a.id) ?? 0,
    }))

    const offering = offerings[0]
    const overrides: OfferingOverrides | null = offering
      ? { duration_minutes: offering.duration_minutes, capacity: offering.capacity }
      : null

    return {
      provider,
      resource: toResourceSettings(provider as ProviderRow),
      offering: overrides,
      rules,
      exceptions: exceptions as {
        date: Date
        type: "blackout" | "extra_hours"
        start_time?: string | null
        end_time?: string | null
      }[],
      existing,
    }
  }

  /**
   * The slots a buyer (or the seller's preview) sees: computed live from the
   * resource's weekly hours, holidays, session length, buffers, notice window
   * and existing bookings. Nothing is stored until someone reserves a slot.
   */
  async listBookableSlots(input: {
    provider_id: string
    product_id?: string | null
    from: Date
    to: Date
    now?: Date
  }): Promise<Slot[]> {
    const now = input.now ?? new Date()
    const ctx = await this.loadAvailabilityContext(
      input.provider_id,
      input.from,
      input.to,
      input.product_id,
      now
    )

    return computeSlots({
      resource: ctx.resource,
      offering: ctx.offering,
      product_id: input.product_id ?? null,
      rules: ctx.rules,
      exceptions: ctx.exceptions,
      existing: ctx.existing,
      from: input.from,
      to: input.to,
      now,
    })
  }

  /**
   * The times one existing booking could move to: same resource and service, as
   * the buyer-facing engine computes them, except that
   *  - a booking alone in its slot does not block its own neighbouring times, and
   *  - its current time is not offered.
   * `waiveNotice` (the business moving a booking) drops the minimum-notice rule.
   */
  async listRescheduleSlots(input: {
    appointment_attendee_id: string
    from: Date
    to: Date
    waiveNotice: boolean
    now?: Date
  }) {
    const now = input.now ?? new Date()
    const attendee = await this.retrieveAppointmentAttendee(input.appointment_attendee_id)
    const old = await this.retrieveAppointment(attendee.appointment_id)

    const slotAttendees = await this.listAppointmentAttendees(
      { appointment_id: old.id, status: ["reserved", "confirmed"] },
      { take: null, select: ["id", "status", "expires_at"] }
    )
    const solo = !slotAttendees.some((a) => a.id !== attendee.id && isLiveAttendee(a, now))

    const ctx = await this.loadAvailabilityContext(
      old.provider_id,
      input.from,
      input.to,
      old.service_product_id,
      now,
      solo ? old.id : null
    )

    const slots = computeSlots({
      resource: input.waiveNotice
        ? { ...ctx.resource, min_notice_minutes: 0 }
        : ctx.resource,
      offering: ctx.offering,
      product_id: old.service_product_id,
      rules: ctx.rules,
      exceptions: ctx.exceptions,
      existing: ctx.existing,
      from: input.from,
      to: input.to,
      now,
    }).filter((s) => s.start.getTime() !== new Date(old.start_time).getTime())

    return { slots, appointment: old, provider: ctx.provider }
  }

  /**
   * Re-validates one exact start time against live data. Used by every
   * reservation so the client can never book a time that is not genuinely
   * offered. Returns the slot (including an existing booking id when the same
   * window already has a row), or null.
   */
  async findBookableSlotAt(input: {
    provider_id: string
    product_id?: string | null
    start: Date
    now?: Date
    ignore_appointment_id?: string | null
  }): Promise<{ slot: Slot | null; ctx: Awaited<ReturnType<AppointmentBookingModuleService["loadAvailabilityContext"]>> }> {
    const now = input.now ?? new Date()
    const ctx = await this.loadAvailabilityContext(
      input.provider_id,
      input.start,
      input.start,
      input.product_id,
      now,
      input.ignore_appointment_id
    )

    const slot = findBookableSlot({
      resource: ctx.resource,
      offering: ctx.offering,
      product_id: input.product_id ?? null,
      rules: ctx.rules,
      exceptions: ctx.exceptions,
      existing: ctx.existing,
      start: input.start,
      now,
    })

    return { slot, ctx }
  }

  /**
   * @deprecated Kept so the pre-multi-resource routes keep compiling until they
   * are retired (Plan 3, phase 4). Delegates to the v2 engine, so it now
   * respects the resource's timezone, buffers and notice window, and returns
   * only genuinely free windows.
   */
  async expandAvailableSlots(
    provider_id: string,
    service_duration_minutes: number,
    date_from: Date,
    date_to: Date
  ): Promise<TimeWindow[]> {
    // Workflow step inputs are JSON-serialized in transit, so a Date passed
    // into the workflow arrives here as an ISO string, not a Date instance.
    const from = new Date(date_from)
    const to = new Date(date_to)
    const now = new Date()

    const ctx = await this.loadAvailabilityContext(provider_id, from, to, null, now)

    const slots = computeSlots({
      resource: ctx.resource,
      offering: { duration_minutes: service_duration_minutes },
      rules: ctx.rules,
      exceptions: ctx.exceptions,
      existing: ctx.existing,
      from,
      to,
      now,
    })

    return slots.map((s) => ({ start: s.start, end: s.end }))
  }
}

export default AppointmentBookingModuleService
