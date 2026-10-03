import { MedusaService } from "@medusajs/framework/utils"
import { Provider } from "./models/provider"
import { RecurringAvailability } from "./models/recurring-availability"
import { AvailabilityException } from "./models/availability-exception"
import { ServiceProvider } from "./models/service-provider"
import { Appointment } from "./models/appointment"
import { AppointmentAttendee } from "./models/appointment-attendee"

type TimeWindow = { start: Date; end: Date }

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

function dateAtMinutes(day: Date, minutes: number): Date {
  const d = new Date(day)
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCMinutes(minutes)
  return d
}

function subtractWindow(windows: TimeWindow[], remove: TimeWindow): TimeWindow[] {
  const result: TimeWindow[] = []
  for (const w of windows) {
    if (remove.end <= w.start || remove.start >= w.end) {
      result.push(w)
      continue
    }
    if (remove.start > w.start) {
      result.push({ start: w.start, end: remove.start })
    }
    if (remove.end < w.end) {
      result.push({ start: remove.end, end: w.end })
    }
  }
  return result
}

class AppointmentBookingModuleService extends MedusaService({
  Provider,
  RecurringAvailability,
  AvailabilityException,
  ServiceProvider,
  Appointment,
  AppointmentAttendee,
}) {
  async countActiveAttendees(appointment_id: string) {
    const [, count] = await this.listAndCountAppointmentAttendees({
      appointment_id,
      status: ["reserved", "confirmed"],
    })

    return count
  }

  /**
   * Pure computation: recurring rules for provider_id, minus exception
   * blackouts, plus exception extra-hours, minus already-booked
   * appointments, sliced into service_duration_minutes-sized slots. Callable
   * directly from a store route for a read - no workflow/lock needed since
   * nothing is written.
   */
  async expandAvailableSlots(
    provider_id: string,
    service_duration_minutes: number,
    date_from: Date,
    date_to: Date
  ): Promise<TimeWindow[]> {
    // Workflow step inputs are JSON-serialized in transit, so a Date passed
    // into the workflow arrives here as an ISO string, not a Date instance.
    date_from = new Date(date_from)
    date_to = new Date(date_to)

    const [recurring, exceptions, existing] = await Promise.all([
      this.listRecurringAvailabilities({
        provider_id,
        status: "active",
      }),
      this.listAvailabilityExceptions({
        provider_id,
        date: { $gte: date_from, $lte: date_to },
      }),
      this.listAppointments({
        provider_id,
        status: ["available", "booked"],
        start_time: { $lte: date_to },
        end_time: { $gte: date_from },
      }),
    ])

    const exceptionsByDay = new Map<string, typeof exceptions>()
    for (const exception of exceptions) {
      const key = new Date(exception.date).toISOString().slice(0, 10)
      const list = exceptionsByDay.get(key) ?? []
      list.push(exception)
      exceptionsByDay.set(key, list)
    }

    const slots: TimeWindow[] = []

    for (
      let day = new Date(Date.UTC(
        date_from.getUTCFullYear(),
        date_from.getUTCMonth(),
        date_from.getUTCDate()
      ));
      day <= date_to;
      day.setUTCDate(day.getUTCDate() + 1)
    ) {
      const dayKey = day.toISOString().slice(0, 10)
      const dayExceptions = exceptionsByDay.get(dayKey) ?? []
      const blackout = dayExceptions.find((e) => e.type === "blackout" && !e.start_time)
      if (blackout) {
        continue
      }

      const dayOfWeek = day.getUTCDay()
      let windows: TimeWindow[] = recurring
        .filter((rule) => rule.day_of_week === dayOfWeek)
        .filter((rule) => {
          const from = new Date(rule.effective_from)
          const until = rule.effective_until ? new Date(rule.effective_until) : null
          return day >= from && (!until || day <= until)
        })
        .map((rule) => ({
          start: dateAtMinutes(day, timeToMinutes(rule.start_time)),
          end: dateAtMinutes(day, timeToMinutes(rule.end_time)),
        }))

      for (const exception of dayExceptions) {
        if (exception.type === "blackout" && exception.start_time && exception.end_time) {
          windows = subtractWindow(windows, {
            start: dateAtMinutes(day, timeToMinutes(exception.start_time)),
            end: dateAtMinutes(day, timeToMinutes(exception.end_time)),
          })
        } else if (exception.type === "extra_hours" && exception.start_time && exception.end_time) {
          windows.push({
            start: dateAtMinutes(day, timeToMinutes(exception.start_time)),
            end: dateAtMinutes(day, timeToMinutes(exception.end_time)),
          })
        }
      }

      for (const booked of existing) {
        const bookedStart = new Date(booked.start_time)
        const bookedEnd = new Date(booked.end_time)
        if (bookedStart.toISOString().slice(0, 10) !== dayKey) {
          continue
        }
        windows = subtractWindow(windows, { start: bookedStart, end: bookedEnd })
      }

      for (const window of windows) {
        let cursor = window.start
        while (cursor.getTime() + service_duration_minutes * 60_000 <= window.end.getTime()) {
          const slotEnd = new Date(cursor.getTime() + service_duration_minutes * 60_000)
          if (slotEnd > date_from || cursor >= date_from) {
            slots.push({ start: new Date(cursor), end: slotEnd })
          }
          cursor = slotEnd
        }
      }
    }

    return slots
  }
}

export default AppointmentBookingModuleService
