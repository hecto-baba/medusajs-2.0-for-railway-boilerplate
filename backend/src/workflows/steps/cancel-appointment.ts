import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { APPOINTMENT_BOOKING_MODULE } from "../../modules/appointment-booking"
import AppointmentBookingModuleService from "../../modules/appointment-booking/service"

export type CancelAppointmentStepInput = {
  appointment_attendee_id: string
}

/**
 * Cancels one attendee's booking and frees their spot. Does not touch
 * payment/refunds - that stays a deliberate, separate admin action so
 * cancelling never silently moves money.
 */
export const cancelAppointmentStep = createStep(
  "cancel-appointment",
  async ({ appointment_attendee_id }: CancelAppointmentStepInput, { container }) => {
    const service: AppointmentBookingModuleService = container.resolve(
      APPOINTMENT_BOOKING_MODULE
    )

    const attendee = await service.retrieveAppointmentAttendee(appointment_attendee_id)

    if (attendee.status === "cancelled") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Attendee ${appointment_attendee_id} is already cancelled`
      )
    }

    const previousStatus = attendee.status

    await service.updateAppointmentAttendees({
      id: appointment_attendee_id,
      status: "cancelled",
    })

    const appointment = await service.retrieveAppointment(attendee.appointment_id)

    if (appointment.status === "booked") {
      await service.updateAppointments({
        id: appointment.id,
        status: "available",
      })
    }

    return new StepResponse(
      { appointment_attendee_id, appointment_id: appointment.id },
      { appointment_attendee_id, previousStatus, appointment_id: appointment.id, previousAppointmentStatus: appointment.status }
    )
  },
  async (compensationData, { container }) => {
    if (!compensationData) return

    const service: AppointmentBookingModuleService = container.resolve(
      APPOINTMENT_BOOKING_MODULE
    )

    await service.updateAppointmentAttendees({
      id: compensationData.appointment_attendee_id,
      status: compensationData.previousStatus,
    })

    await service.updateAppointments({
      id: compensationData.appointment_id,
      status: compensationData.previousAppointmentStatus,
    })
  }
)
