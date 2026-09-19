import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { APPOINTMENT_BOOKING_MODULE } from "../../modules/appointment-booking"
import AppointmentBookingModuleService from "../../modules/appointment-booking/service"

export type ValidateAppointmentAvailabilityStepInput = {
  appointment_ids: string[]
}

/**
 * Fast, friendly rejection before the DB has to reject the write itself.
 *
 * This is NOT the safety guarantee against overbooking - the caller's lock
 * is keyed on cart_id, not appointment_id, so two different carts racing to
 * book the same appointment can both pass this check before either writes.
 * The real guarantee is the appointment_attendee_capacity_check DB trigger
 * (see the migration of the same name), which locks the appointment row and
 * rejects an insert that would exceed capacity regardless of what any
 * application-level check already concluded. This step exists purely so the
 * common case (slot genuinely unavailable) gets a clean, immediate error
 * instead of a database exception surfacing from deeper in the workflow.
 */
export const validateAppointmentAvailabilityStep = createStep(
  "validate-appointment-availability",
  async ({ appointment_ids }: ValidateAppointmentAvailabilityStepInput, { container }) => {
    const service: AppointmentBookingModuleService = container.resolve(
      APPOINTMENT_BOOKING_MODULE
    )

    const uniqueIds = [...new Set(appointment_ids)]
    const appointments = await service.listAppointments({ id: uniqueIds })
    const appointmentById = new Map(appointments.map((a) => [a.id, a]))

    const activeCounts = await Promise.all(
      uniqueIds.map((id) => service.countActiveAttendees(id))
    )
    const countById = new Map(uniqueIds.map((id, i) => [id, activeCounts[i]]))

    for (const appointment_id of uniqueIds) {
      const appointment = appointmentById.get(appointment_id)

      if (!appointment || appointment.status === "cancelled") {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Appointment ${appointment_id} has been cancelled`
        )
      }

      const activeAttendees = countById.get(appointment_id) ?? 0

      if (activeAttendees >= appointment.max_capacity) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Appointment ${appointment_id} is fully booked`
        )
      }
    }

    return new StepResponse({ validated: true })
  }
)
