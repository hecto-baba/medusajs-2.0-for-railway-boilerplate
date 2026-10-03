import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { APPOINTMENT_BOOKING_MODULE } from "../../modules/appointment-booking"
import AppointmentBookingModuleService from "../../modules/appointment-booking/service"
import {
  isCapacityViolation,
  isExclusionViolation,
} from "../../modules/appointment-booking/lib/db-errors"

export type ConfirmAppointmentAttendeesInput = {
  order_id: string
  items: { id: string; metadata: Record<string, unknown> | null }[]
}

/**
 * After the order exists: turns each held place into a confirmed booking and
 * marks its slot booked. The places were reserved when the item went into the
 * cart, so nothing is being newly claimed here - this only confirms.
 *
 * Idempotent: an attendee already confirmed for this order is left untouched,
 * so a retried completion cannot book twice.
 */
export const confirmAppointmentAttendeesStep = createStep(
  "confirm-appointment-attendees",
  async ({ order_id, items }: ConfirmAppointmentAttendeesInput, { container }) => {
    const service: AppointmentBookingModuleService = container.resolve(
      APPOINTMENT_BOOKING_MODULE
    )

    const lineByAttendee = new Map<string, string>()
    for (const item of items) {
      const attendeeId = item.metadata?.attendee_id as string | undefined
      if (attendeeId) lineByAttendee.set(attendeeId, item.id)
    }

    if (!lineByAttendee.size) {
      return new StepResponse([], undefined)
    }

    const attendees = await service.listAppointmentAttendees(
      { id: [...lineByAttendee.keys()] },
      { take: null }
    )

    if (attendees.length !== lineByAttendee.size) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "A reserved appointment in this order could not be found."
      )
    }

    const toConfirm = attendees.filter(
      (a) => !(a.status === "confirmed" && a.order_id === order_id)
    )

    const previous = toConfirm.map((a) => ({
      id: a.id,
      status: a.status,
      order_id: a.order_id ?? null,
      line_item_id: a.line_item_id ?? null,
      expires_at: a.expires_at ?? null,
    }))

    if (toConfirm.length) {
      try {
        await service.updateAppointmentAttendees(
          toConfirm.map((a) => ({
            id: a.id,
            status: "confirmed" as const,
            order_id,
            line_item_id: lineByAttendee.get(a.id)!,
            expires_at: null,
            // A place the release job reclaimed in the meantime is revived here
            // only if the capacity trigger still allows it.
            cancelled_at: null,
            cancelled_by: null,
            cancel_reason: null,
          }))
        )
      } catch (err: any) {
        if (isCapacityViolation(err)) {
          throw new MedusaError(
            MedusaError.Types.NOT_ALLOWED,
            "Your payment was received but the time could no longer be secured. The business has been notified and will contact you."
          )
        }
        throw err
      }

      const appointmentIds = [...new Set(toConfirm.map((a) => a.appointment_id))]
      const appointments = await service.listAppointments(
        { id: appointmentIds },
        { select: ["id", "status", "order_id"], take: null }
      )

      const updates = appointments
        .filter((a) => a.status !== "completed")
        .map((a) => ({
          id: a.id,
          status: "booked" as const,
          order_id: a.order_id ?? order_id,
        }))

      if (updates.length) {
        try {
          await service.updateAppointments(updates)
        } catch (err: any) {
          // A slot the release job had marked empty is being re-opened; if
          // someone else took that time in the meantime the overlap constraint
          // refuses it.
          if (isExclusionViolation(err)) {
            throw new MedusaError(
              MedusaError.Types.NOT_ALLOWED,
              "Your payment was received but the time could no longer be secured. The business has been notified and will contact you."
            )
          }
          throw err
        }
      }
    }

    const confirmed = await service.listAppointmentAttendees(
      { id: [...lineByAttendee.keys()] },
      { select: ["id", "appointment_id", "status"], take: null }
    )

    return new StepResponse(confirmed, previous)
  },
  async (previous, { container }) => {
    if (!previous?.length) return

    const service: AppointmentBookingModuleService = container.resolve(
      APPOINTMENT_BOOKING_MODULE
    )

    await service.updateAppointmentAttendees(
      previous.map((p) => ({
        id: p.id,
        status: p.status,
        order_id: p.order_id,
        line_item_id: p.line_item_id,
        expires_at: p.expires_at,
      }))
    )
  }
)
