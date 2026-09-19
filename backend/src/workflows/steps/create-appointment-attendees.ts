import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { APPOINTMENT_BOOKING_MODULE } from "../../modules/appointment-booking"
import AppointmentBookingModuleService from "../../modules/appointment-booking/service"

export type CreateAppointmentAttendeesStepInput = {
  order_id: string
  customer_id: string
  items: {
    id: string
    metadata: Record<string, unknown> | null
  }[]
}

export const createAppointmentAttendeesStep = createStep(
  "create-appointment-attendees",
  async ({ order_id, customer_id, items }: CreateAppointmentAttendeesStepInput, { container }) => {
    const service: AppointmentBookingModuleService = container.resolve(
      APPOINTMENT_BOOKING_MODULE
    )

    const toCreate = items.flatMap((item) => {
      const appointmentId = item.metadata?.appointment_id as string | undefined
      if (!appointmentId) {
        return []
      }

      return [
        {
          appointment_id: appointmentId,
          customer_id,
          order_id,
          line_item_id: item.id,
          status: "confirmed" as const,
        },
      ]
    })

    if (!toCreate.length) {
      return new StepResponse([], [])
    }

    // The appointment_attendee_capacity_check DB trigger is the real
    // guarantee here: it locks the parent appointment row and rejects this
    // insert if it would exceed max_capacity, even if two carts race past
    // the earlier application-level check in validate-appointment-availability.
    // A Postgres check_violation surfaces as a generic driver error, so it's
    // translated into a clean MedusaError here rather than leaking a raw SQL
    // exception to the customer.
    let attendees: Awaited<ReturnType<typeof service.createAppointmentAttendees>>
    try {
      attendees = await service.createAppointmentAttendees(toCreate)
    } catch (err: any) {
      if (err?.code === "23514" || /fully booked/i.test(err?.message ?? "")) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "One of the selected appointments was booked by someone else. Please choose another slot."
        )
      }
      throw err
    }

    const appointmentIds = [...new Set(attendees.map((a) => a.appointment_id))]
    const appointments = await service.listAppointments({ id: appointmentIds })
    const appointmentById = new Map(appointments.map((a) => [a.id, a]))

    const activeCounts = await Promise.all(
      appointmentIds.map((id) => service.countActiveAttendees(id))
    )
    const countById = new Map(appointmentIds.map((id, i) => [id, activeCounts[i]]))

    for (const appointmentId of appointmentIds) {
      const appointment = appointmentById.get(appointmentId)
      const activeAttendees = countById.get(appointmentId) ?? 0

      if (appointment && activeAttendees >= appointment.max_capacity) {
        await service.updateAppointments({
          id: appointmentId,
          status: "booked",
          order_id: appointment.order_id ?? order_id,
        })
      }
    }

    return new StepResponse(
      attendees,
      attendees.map((a) => a.id)
    )
  },
  async (ids, { container }) => {
    if (!ids?.length) return

    const service: AppointmentBookingModuleService = container.resolve(
      APPOINTMENT_BOOKING_MODULE
    )

    await service.deleteAppointmentAttendees(ids)
  }
)
