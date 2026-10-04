import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { APPOINTMENT_BOOKING_MODULE } from "../../modules/appointment-booking"
import AppointmentBookingModuleService from "../../modules/appointment-booking/service"
import {
  validateWeeklyWindow,
  weeklyWindowsOverlap,
} from "../../modules/appointment-booking/lib/availability"
import { isUniqueViolation } from "../../modules/appointment-booking/lib/db-errors"

export type CreateRecurringAvailabilityStepInput = {
  provider_id: string
  day_of_week: number
  start_time: string
  end_time: string
  effective_from: Date
  effective_until?: Date | null
}

/** Calendar date (UTC midnight) of whatever instant the client sent. */
const calendarDate = (value: Date | string): Date =>
  new Date(`${new Date(value).toISOString().slice(0, 10)}T00:00:00.000Z`)

const dateKey = (value: Date | string) => new Date(value).toISOString().slice(0, 10)

/** Do two effective-date ranges share at least one day? (null until = open-ended) */
const rangesIntersect = (
  a: { from: string; until: string | null },
  b: { from: string; until: string | null }
) =>
  (a.until === null || b.from <= a.until) && (b.until === null || a.from <= b.until)

export const createRecurringAvailabilityStep = createStep(
  "create-recurring-availability",
  async (input: CreateRecurringAvailabilityStepInput, { container }) => {
    const service: AppointmentBookingModuleService = container.resolve(
      APPOINTMENT_BOOKING_MODULE
    )

    const problem = validateWeeklyWindow(input)
    if (problem) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, problem)
    }

    const [provider] = await service.listProviders(
      { id: input.provider_id },
      { select: ["id"], take: 1 }
    )
    if (!provider) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Resource not found.")
    }

    const effective_from = calendarDate(input.effective_from)
    const effective_until = input.effective_until ? calendarDate(input.effective_until) : null

    const sameDay = await service.listRecurringAvailabilities(
      { provider_id: input.provider_id, day_of_week: input.day_of_week },
      { take: null }
    )

    // Idempotent: submitting the same window twice (double click, retry)
    // returns the existing rule instead of creating a duplicate.
    const identical = sameDay.find(
      (r) =>
        r.start_time === input.start_time &&
        r.end_time === input.end_time &&
        dateKey(r.effective_from) === dateKey(effective_from)
    )
    if (identical) {
      return new StepResponse(identical, undefined)
    }

    // Overlapping windows on the same weekday would double-count the same hours.
    const mine = {
      from: dateKey(effective_from),
      until: effective_until ? dateKey(effective_until) : null,
    }
    const clash = sameDay.find(
      (r) =>
        r.status === "active" &&
        weeklyWindowsOverlap(r, input) &&
        rangesIntersect(mine, {
          from: dateKey(r.effective_from),
          until: r.effective_until ? dateKey(r.effective_until) : null,
        })
    )
    if (clash) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `These hours overlap existing hours on the same day (${clash.start_time}-${clash.end_time}).`
      )
    }

    try {
      const rule = await service.createRecurringAvailabilities({
        ...input,
        effective_from,
        effective_until,
      })
      return new StepResponse(rule, rule.id)
    } catch (err) {
      // A concurrent identical request won the race; the unique index rejected
      // ours. Return what is stored.
      if (!isUniqueViolation(err)) throw err
      const [existing] = await service.listRecurringAvailabilities(
        {
          provider_id: input.provider_id,
          day_of_week: input.day_of_week,
          start_time: input.start_time,
          end_time: input.end_time,
          effective_from,
        },
        { take: 1 }
      )
      if (!existing) throw err
      return new StepResponse(existing, undefined)
    }
  },
  async (ruleId, { container }) => {
    if (!ruleId) return

    const service: AppointmentBookingModuleService = container.resolve(
      APPOINTMENT_BOOKING_MODULE
    )

    await service.deleteRecurringAvailabilities(ruleId)
  }
)
