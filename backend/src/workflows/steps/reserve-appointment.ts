import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { APPOINTMENT_BOOKING_MODULE } from "../../modules/appointment-booking"
import AppointmentBookingModuleService from "../../modules/appointment-booking/service"
import {
  isCapacityViolation,
  isExclusionViolation,
  isUniqueViolation,
} from "../../modules/appointment-booking/lib/db-errors"

export type ReserveAppointmentInput = {
  resource_id: string
  product_id: string
  variant_id: string
  start: string | Date
  customer_id: string | null
  buyer: {
    name: string
    email: string
    phone?: string | null
    notes?: string | null
  }
}

const TAKEN =
  "Sorry, that time was just taken. Please choose another time."

/**
 * Holds one place in a slot for the buyer while they pay.
 *
 * Re-validates the exact start time against live data, so a client can never
 * reserve a time that is not genuinely offered. The caller holds a lock keyed on
 * resource + start, which serializes buyers racing for the same slot; the
 * database is the real guarantee behind it - the overlap exclusion constraint
 * rejects a colliding row and the capacity trigger rejects an over-full slot,
 * and both are translated here into one clean "just taken" message.
 *
 * Compensation releases the hold (and the slot row, if this call created it and
 * nobody else joined it), so a later failure in the same workflow - e.g. the
 * cart add - never leaves a place held.
 */
export const reserveAppointmentStep = createStep(
  "reserve-appointment",
  async (input: ReserveAppointmentInput, { container }) => {
    const service: AppointmentBookingModuleService = container.resolve(
      APPOINTMENT_BOOKING_MODULE
    )
    const start = new Date(input.start)
    const now = new Date()

    const { slot, ctx } = await service.findBookableSlotAt({
      provider_id: input.resource_id,
      product_id: input.product_id,
      start,
      now,
    })

    if (!slot) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, TAKEN)
    }

    const holdMinutes = ctx.provider.hold_minutes
    const expiresAt = new Date(now.getTime() + holdMinutes * 60_000)

    let appointmentId = slot.appointment_id ?? null
    let createdAppointment = false

    if (!appointmentId) {
      try {
        const appointment = await service.createAppointments({
          provider_id: input.resource_id,
          service_product_id: input.product_id,
          service_variant_id: input.variant_id,
          start_time: slot.start,
          end_time: slot.end,
          max_capacity: slot.capacity,
          buffer_before_minutes: ctx.provider.buffer_before_minutes,
          buffer_after_minutes: ctx.provider.buffer_after_minutes,
          resource_timezone: ctx.provider.timezone,
          status: "available",
        })
        appointmentId = appointment.id
        createdAppointment = true
      } catch (err: any) {
        // Exclusion violation: another booking's block overlaps.
        if (isExclusionViolation(err)) {
          throw new MedusaError(MedusaError.Types.NOT_ALLOWED, TAKEN)
        }
        throw err
      }
    }

    try {
      const attendee = await service.createAppointmentAttendees({
        appointment_id: appointmentId,
        customer_id: input.customer_id,
        buyer_name: input.buyer.name,
        buyer_email: input.buyer.email,
        buyer_phone: input.buyer.phone ?? null,
        notes: input.buyer.notes ?? null,
        status: "reserved",
        expires_at: expiresAt,
      })

      return new StepResponse(
        {
          attendee_id: attendee.id,
          appointment_id: appointmentId,
          start_time: slot.start.toISOString(),
          end_time: slot.end.toISOString(),
          hold_expires_at: expiresAt.toISOString(),
          hold_minutes: holdMinutes,
        },
        {
          attendee_id: attendee.id,
          appointment_id: appointmentId,
          createdAppointment,
        }
      )
    } catch (err: any) {
      if (createdAppointment && appointmentId) {
        // Nobody else can have joined in the instant since we created it.
        await service.deleteAppointments(appointmentId).catch(() => {})
      }
      // The capacity trigger refused the place.
      if (isCapacityViolation(err)) {
        throw new MedusaError(MedusaError.Types.NOT_ALLOWED, TAKEN)
      }
      // This customer already holds a place in this slot.
      if (isUniqueViolation(err)) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "You already have a booking for this time."
        )
      }
      throw err
    }
  },
  async (comp, { container }) => {
    if (!comp) return

    const service: AppointmentBookingModuleService = container.resolve(
      APPOINTMENT_BOOKING_MODULE
    )

    await service.deleteAppointmentAttendees(comp.attendee_id).catch(() => {})

    if (comp.createdAppointment) {
      const [stillHeld] = await service.listAppointmentAttendees(
        { appointment_id: comp.appointment_id },
        { select: ["id"], take: 1 }
      )
      if (!stillHeld) {
        await service.deleteAppointments(comp.appointment_id).catch(() => {})
      }
    }
  }
)
