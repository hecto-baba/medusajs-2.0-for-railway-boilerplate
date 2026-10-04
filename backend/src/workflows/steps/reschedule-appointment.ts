import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { APPOINTMENT_BOOKING_MODULE } from "../../modules/appointment-booking"
import AppointmentBookingModuleService, {
  isLiveAttendee,
} from "../../modules/appointment-booking/service"
import {
  isCapacityViolation,
  isExclusionViolation,
} from "../../modules/appointment-booking/lib/db-errors"
import {
  checkReschedule,
  RescheduleActor,
} from "../../modules/appointment-booking/lib/reschedule-rules"
import {
  buyerPriceGuard,
  PRICED_DIFFERENTLY,
} from "../../modules/appointment-booking/lib/reschedule-pricing"
import { statusAfterRemoval } from "./cancel-appointment"

export type RescheduleAppointmentStepInput = {
  appointment_attendee_id: string
  new_start: string | Date
  rescheduled_by: RescheduleActor
}

const TAKEN = "That time is no longer available. Please choose another time."

/**
 * Moves one attendee's confirmed booking to another time on the same resource
 * and service. The order, payment and line item stay as they are.
 *
 * Two shapes, chosen by who else is in the slot being left:
 *
 *  - Alone in it: that slot row is edited in place (new start/end, buffers
 *    refreshed). A move by a few minutes overlaps the booking's own old window,
 *    so creating a second row would be refused by the overlap constraint; editing
 *    the row has no such collision. The availability lookup ignores that row for
 *    the same reason. The edit is ONE guarded statement that only applies while
 *    nobody else has a place in the row, so a buyer who takes a place in it
 *    between our check and our write can never be carried along to the new time.
 *  - Sharing it (a group slot): the attendee is moved to another slot row (an
 *    existing one with room, or a new one) and the old slot is then recomputed
 *    from whoever is in it at that moment (re-read, not the earlier list).
 *
 * The database stays the real guard: the overlap constraint and capacity trigger
 * refuse a colliding move, and both become one clean "no longer available".
 * A failure part-way undoes whatever this attempt had changed. (Medusa has no
 * cross-call transaction here, so a process crash mid-move cannot undo itself;
 * the worst case is an emptied slot row left "booked", which the existing
 * empty-slot cleanup script removes.)
 *
 * Only a buyer's own moves count against the buyer's reschedule limit, and only
 * a buyer is held to the same-price rule.
 */
export const rescheduleAppointmentStep = createStep(
  "reschedule-appointment",
  async (
    { appointment_attendee_id, new_start, rescheduled_by }: RescheduleAppointmentStepInput,
    { container }
  ) => {
    const service: AppointmentBookingModuleService = container.resolve(
      APPOINTMENT_BOOKING_MODULE
    )
    const logger = container.resolve("logger")
    const realNow = new Date()
    const start = new Date(new_start)
    if (isNaN(start.getTime())) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "That is not a valid time.")
    }

    const attendee = await service.retrieveAppointmentAttendee(appointment_attendee_id)
    const old = await service.retrieveAppointment(attendee.appointment_id)
    const resource = await service.retrieveProvider(old.provider_id)

    const allowed = checkReschedule({
      actor: rescheduled_by,
      attendeeStatus: attendee.status,
      slotStatus: old.status,
      slotStart: old.start_time,
      cancellationWindowHours: resource.cancellation_window_hours,
      rescheduleCount: attendee.reschedule_count ?? 0,
      now: realNow,
    })
    if (allowed.ok === false) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, allowed.reason)
    }

    if (start.getTime() === new Date(old.start_time).getTime()) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "The booking is already at that time."
      )
    }

    if (rescheduled_by === "buyer") {
      const samePrice = await buyerPriceGuard(container, service, {
        orderId: attendee.order_id,
        resourceId: old.provider_id,
        productId: old.service_product_id,
        vendorId: resource.vendor_id,
        timezone: old.resource_timezone ?? resource.timezone,
        currentStart: old.start_time,
      })
      if (samePrice && !samePrice(start)) {
        throw new MedusaError(MedusaError.Types.NOT_ALLOWED, PRICED_DIFFERENTLY)
      }
    }

    const slotAttendees = await service.listAppointmentAttendees(
      { appointment_id: old.id, status: ["reserved", "confirmed"] },
      { take: null, select: ["id", "status", "expires_at", "order_id"] }
    )
    const solo = !slotAttendees.some((a) => a.id !== attendee.id && isLiveAttendee(a, realNow))

    // The business may move a booking inside the notice window (like a walk-in
    // entered by hand); a buyer may not.
    const now =
      rescheduled_by === "buyer"
        ? realNow
        : new Date(Math.min(realNow.getTime(), start.getTime() - 1000))

    const { slot, ctx } = await service.findBookableSlotAt({
      provider_id: old.provider_id,
      product_id: old.service_product_id,
      start,
      now,
      ignore_appointment_id: solo ? old.id : null,
    })
    if (!slot) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, TAKEN)
    }

    const attendeeBefore = {
      appointment_id: attendee.appointment_id,
      reschedule_count: attendee.reschedule_count ?? 0,
      rescheduled_from_start: attendee.rescheduled_from_start ?? null,
      rescheduled_by: attendee.rescheduled_by ?? null,
      reschedule_notified_at: attendee.reschedule_notified_at ?? null,
    }

    const inPlace = solo && !slot.appointment_id
    let targetId = old.id
    let createdTarget = false
    let targetBefore: { status: string; order_id: string | null } | null = null
    let oldBeforeEdit: Record<string, unknown> | null = null
    let movedAttendee = false
    let oldChanged = false

    // Evaluated when called, so it reflects exactly what has been changed so far.
    const compensationData = (): CompensationData => ({
      attendee_id: attendee.id,
      attendeeBefore,
      inPlace,
      oldId: old.id,
      oldBeforeEdit,
      oldBefore: { status: old.status, order_id: old.order_id ?? null },
      oldChanged,
      movedAttendee,
      targetId,
      createdTarget,
      targetBefore,
    })

    try {
      if (inPlace) {
        oldBeforeEdit = {
          start_time: old.start_time,
          end_time: old.end_time,
          max_capacity: old.max_capacity,
          buffer_before_minutes: old.buffer_before_minutes,
          buffer_after_minutes: old.buffer_after_minutes,
          resource_timezone: old.resource_timezone ?? null,
        }
        const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
        const { rows } = await pg.raw(
          `
          update appointment
             set start_time = ?, end_time = ?, max_capacity = ?,
                 buffer_before_minutes = ?, buffer_after_minutes = ?,
                 resource_timezone = ?, updated_at = now()
           where id = ?
             and deleted_at is null
             and not exists (
               select 1 from appointment_attendee t
                where t.appointment_id = appointment.id
                  and t.id <> ?
                  and t.deleted_at is null
                  and t.status != 'cancelled'
                  and not (t.status = 'reserved' and t.expires_at is not null and t.expires_at <= now())
             )
          returning id
          `,
          [
            slot.start.toISOString(),
            slot.end.toISOString(),
            slot.capacity,
            ctx.provider.buffer_before_minutes,
            ctx.provider.buffer_after_minutes,
            ctx.provider.timezone,
            old.id,
            attendee.id,
          ]
        )
        // Someone took a place in this slot after we looked: do not drag them along.
        if (!rows.length) {
          throw new MedusaError(MedusaError.Types.NOT_ALLOWED, TAKEN)
        }
        oldChanged = true
      } else {
        if (slot.appointment_id) {
          targetId = slot.appointment_id
          const [target] = await service.listAppointments(
            { id: targetId },
            { select: ["id", "status", "order_id"], take: 1 }
          )
          if (!target) {
            throw new MedusaError(MedusaError.Types.NOT_ALLOWED, TAKEN)
          }
          targetBefore = { status: target.status, order_id: target.order_id ?? null }
        } else {
          const created = await service.createAppointments({
            provider_id: old.provider_id,
            service_product_id: old.service_product_id,
            service_variant_id: old.service_variant_id ?? null,
            start_time: slot.start,
            end_time: slot.end,
            max_capacity: slot.capacity,
            buffer_before_minutes: ctx.provider.buffer_before_minutes,
            buffer_after_minutes: ctx.provider.buffer_after_minutes,
            resource_timezone: ctx.provider.timezone,
            status: "booked",
            order_id: attendee.order_id ?? null,
          })
          targetId = created.id
          createdTarget = true
        }

        movedAttendee = true
        await service.updateAppointmentAttendees({
          id: attendee.id,
          appointment_id: targetId,
        })

        if (!createdTarget) {
          await service.updateAppointments({ id: targetId, status: "booked" })
        }

        // The slot being left: recompute from whoever is in it NOW. Alone, it
        // becomes cancelled, which frees its time for anyone (the overlap
        // constraint ignores cancelled rows).
        const remaining = await service.listAppointmentAttendees(
          { appointment_id: old.id, status: ["reserved", "confirmed"] },
          { take: null, select: ["id", "status", "expires_at", "order_id"] }
        )
        const live = remaining.filter((a) => isLiveAttendee(a, realNow))
        const nextOrderId =
          old.order_id && old.order_id !== attendee.order_id
            ? old.order_id
            : (live.find((a) => a.status === "confirmed" && a.order_id)?.order_id ?? null)

        oldChanged = true
        await service.updateAppointments({
          id: old.id,
          status: statusAfterRemoval(old.status, live, realNow),
          order_id: nextOrderId,
        })
      }

      await service.updateAppointmentAttendees({
        id: attendee.id,
        // Only the buyer's own moves use up the buyer's reschedules.
        reschedule_count: attendeeBefore.reschedule_count + (rescheduled_by === "buyer" ? 1 : 0),
        rescheduled_from_start: old.start_time,
        rescheduled_by,
        reschedule_notified_at: null,
      })
    } catch (err: any) {
      // Put back whatever this attempt had already changed before reporting.
      await undo(service, compensationData()).catch((undoError: any) =>
        logger.error(
          `Could not fully undo a failed reschedule of booking ${attendee.id}: ${undoError?.message}`
        )
      )
      if (isExclusionViolation(err) || isCapacityViolation(err)) {
        throw new MedusaError(MedusaError.Types.NOT_ALLOWED, TAKEN)
      }
      throw err
    }

    return new StepResponse(
      {
        appointment_attendee_id: attendee.id,
        appointment_id: targetId,
        previous_start: new Date(old.start_time).toISOString(),
        start_time: slot.start.toISOString(),
        end_time: slot.end.toISOString(),
      },
      compensationData()
    )
  },
  async (data, { container }) => {
    if (!data) return
    const service: AppointmentBookingModuleService = container.resolve(
      APPOINTMENT_BOOKING_MODULE
    )
    await undo(service, data)
  }
)

type CompensationData = {
  attendee_id: string
  attendeeBefore: {
    appointment_id: string
    reschedule_count: number
    rescheduled_from_start: Date | string | null
    rescheduled_by: RescheduleActor | null
    reschedule_notified_at: Date | string | null
  }
  inPlace: boolean
  oldId: string
  oldBeforeEdit: Record<string, unknown> | null
  oldBefore: { status: string; order_id: string | null }
  oldChanged: boolean
  movedAttendee: boolean
  targetId: string
  createdTarget: boolean
  targetBefore: { status: string; order_id: string | null } | null
}

const toDate = (value: Date | string | null) => (value ? new Date(value) : null)

/**
 * Reverses a reschedule. The order is chosen so no step collides with another:
 * the attendee goes back first, a slot row this move created is deleted before
 * the old row is brought back (they could overlap), then the old row is restored.
 */
const undo = async (service: AppointmentBookingModuleService, c: CompensationData) => {
  await service.updateAppointmentAttendees({
    id: c.attendee_id,
    appointment_id: c.attendeeBefore.appointment_id,
    reschedule_count: c.attendeeBefore.reschedule_count,
    // Compensation data is JSON-serialized by the workflow engine, so dates are
    // strings by now.
    rescheduled_from_start: toDate(c.attendeeBefore.rescheduled_from_start),
    rescheduled_by: c.attendeeBefore.rescheduled_by,
    reschedule_notified_at: toDate(c.attendeeBefore.reschedule_notified_at),
  })

  if (c.createdTarget) {
    await service.deleteAppointments(c.targetId)
  } else if (c.movedAttendee && c.targetBefore) {
    await service.updateAppointments({
      id: c.targetId,
      status: c.targetBefore.status as any,
      order_id: c.targetBefore.order_id,
    })
  }

  if (c.oldChanged) {
    await service.updateAppointments({
      id: c.oldId,
      ...(c.inPlace && c.oldBeforeEdit ? (c.oldBeforeEdit as any) : {}),
      status: c.oldBefore.status as any,
      order_id: c.oldBefore.order_id,
    })
  }
}
