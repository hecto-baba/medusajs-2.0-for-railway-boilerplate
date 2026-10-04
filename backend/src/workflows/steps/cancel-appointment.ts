import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { APPOINTMENT_BOOKING_MODULE } from "../../modules/appointment-booking"
import AppointmentBookingModuleService, {
  isLiveAttendee,
} from "../../modules/appointment-booking/service"

export type CancelAppointmentStepInput = {
  appointment_attendee_id: string
  cancelled_by: "buyer" | "vendor" | "admin" | "system"
  reason?: string | null
}

/**
 * Appointment status semantics (Plan 3):
 *   available - only held (reserved) places, or an empty legacy slot
 *   booked    - at least one confirmed attendee (not necessarily full)
 *   completed - the vendor marked it done
 *   cancelled - no live attendees remain; the row is kept for history and,
 *               because the overlap constraint ignores cancelled rows, the time
 *               is free to book again
 */
export const statusAfterRemoval = (
  current: string,
  attendees: { status: string; expires_at?: Date | string | null }[],
  now: Date
): "available" | "booked" | "cancelled" | "completed" => {
  if (current === "completed") return "completed"
  const live = attendees.filter((a) => isLiveAttendee(a, now))
  if (!live.length) return "cancelled"
  return live.some((a) => a.status === "confirmed") ? "booked" : "available"
}

/**
 * Cancels one attendee's booking and frees their place. Does not touch
 * payment/refunds - that stays a deliberate, separate admin action so
 * cancelling never silently moves money.
 */
export const cancelAppointmentStep = createStep(
  "cancel-appointment",
  async (
    { appointment_attendee_id, cancelled_by, reason }: CancelAppointmentStepInput,
    { container }
  ) => {
    const service: AppointmentBookingModuleService = container.resolve(
      APPOINTMENT_BOOKING_MODULE
    )

    const attendee = await service.retrieveAppointmentAttendee(appointment_attendee_id)

    if (attendee.status === "cancelled") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "This booking is already cancelled."
      )
    }

    const appointment = await service.retrieveAppointment(attendee.appointment_id)
    const now = new Date()

    await service.updateAppointmentAttendees({
      id: appointment_attendee_id,
      status: "cancelled",
      cancelled_at: now,
      cancelled_by,
      cancel_reason: reason ?? null,
      expires_at: null,
    })

    // Recompute from what is actually stored, rather than assuming this was the
    // only attendee: group slots stay open for everyone else.
    const remaining = await service.listAppointmentAttendees(
      { appointment_id: appointment.id, status: ["reserved", "confirmed"] },
      { take: null, select: ["id", "status", "expires_at"] }
    )

    const nextStatus = statusAfterRemoval(appointment.status, remaining, now)
    const hasConfirmed = remaining.some((a) => a.status === "confirmed")

    if (nextStatus !== appointment.status || (!hasConfirmed && appointment.order_id)) {
      await service.updateAppointments({
        id: appointment.id,
        status: nextStatus,
        order_id: hasConfirmed ? appointment.order_id : null,
      })
    }

    return new StepResponse(
      {
        appointment_attendee_id,
        appointment_id: appointment.id,
        order_id: attendee.order_id ?? null,
      },
      {
        appointment_attendee_id,
        previous: {
          status: attendee.status,
          expires_at: attendee.expires_at ?? null,
        },
        appointment_id: appointment.id,
        previousAppointmentStatus: appointment.status,
        previousAppointmentOrderId: appointment.order_id ?? null,
      }
    )
  },
  async (compensationData, { container }) => {
    if (!compensationData) return

    const service: AppointmentBookingModuleService = container.resolve(
      APPOINTMENT_BOOKING_MODULE
    )

    await service.updateAppointmentAttendees({
      id: compensationData.appointment_attendee_id,
      status: compensationData.previous.status,
      expires_at: compensationData.previous.expires_at,
      cancelled_at: null,
      cancelled_by: null,
      cancel_reason: null,
    })

    await service.updateAppointments({
      id: compensationData.appointment_id,
      status: compensationData.previousAppointmentStatus,
      order_id: compensationData.previousAppointmentOrderId,
    })
  }
)
