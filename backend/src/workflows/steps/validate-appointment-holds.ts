import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { APPOINTMENT_BOOKING_MODULE } from "../../modules/appointment-booking"
import AppointmentBookingModuleService from "../../modules/appointment-booking/service"
import { isCapacityViolation } from "../../modules/appointment-booking/lib/db-errors"

export type ValidateAppointmentHoldsInput = {
  cart_id: string
}

const EXPIRED =
  "Your reservation expired. Please choose the time again."

/**
 * Runs BEFORE the cart is completed (and so before payment is finalised): every
 * appointment in the cart must still hold a live place.
 *
 * A place whose hold has merely run past its expiry, but which the cleanup job
 * has not released yet, is still the buyer's - it still counts against the slot
 * - so it is extended instead of failing the checkout. A place that has already
 * been released is gone, and the buyer is told to pick the time again rather
 * than being charged for a slot that no longer exists.
 *
 * Does nothing for carts with no appointments.
 */
export const validateAppointmentHoldsStep = createStep(
  "validate-appointment-holds",
  async ({ cart_id }: ValidateAppointmentHoldsInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)

    const {
      data: [cart],
    } = await query.graph({
      entity: "cart",
      fields: ["id", "items.id", "items.metadata"],
      filters: { id: cart_id },
    })

    const attendeeIds = ((cart?.items ?? []) as any[])
      .map((i) => i?.metadata?.attendee_id as string | undefined)
      .filter((id): id is string => !!id)

    if (!attendeeIds.length) {
      return new StepResponse({ checked: 0 })
    }

    const service: AppointmentBookingModuleService = container.resolve(
      APPOINTMENT_BOOKING_MODULE
    )

    const attendees = await service.listAppointmentAttendees(
      { id: attendeeIds },
      { take: null }
    )
    const byId = new Map(attendees.map((a) => [a.id, a]))

    if (attendeeIds.some((id) => !byId.has(id) || byId.get(id)!.status === "cancelled")) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, EXPIRED)
    }

    const reserved = attendees.filter((a) => a.status === "reserved")
    if (reserved.length) {
      const appointments = await service.listAppointments(
        { id: [...new Set(reserved.map((a) => a.appointment_id))] },
        { select: ["id", "provider_id"], take: null }
      )
      const providers = await service.listProviders(
        { id: [...new Set(appointments.map((a) => a.provider_id))] },
        { select: ["id", "hold_minutes"], take: null }
      )
      const holdByProvider = new Map(providers.map((p) => [p.id, p.hold_minutes]))
      const providerOf = new Map(appointments.map((a) => [a.id, a.provider_id]))

      const now = Date.now()
      try {
        await service.updateAppointmentAttendees(
          reserved.map((a) => ({
            id: a.id,
            expires_at: new Date(
              now + (holdByProvider.get(providerOf.get(a.appointment_id)!) ?? 10) * 60_000
            ),
          }))
        )
      } catch (err) {
        // A lapsed hold no longer counts against capacity, so someone else may
        // have taken the place in the meantime; re-activating this one then
        // trips the capacity trigger. That is the same outcome as a released
        // hold: the buyer chooses the time again, before anything is charged.
        if (isCapacityViolation(err)) {
          throw new MedusaError(MedusaError.Types.NOT_ALLOWED, EXPIRED)
        }
        throw err
      }

      // The release job may have cancelled one between our read and the
      // extension above (an update does not resurrect a cancelled row), so
      // confirm the final state rather than assuming.
      const after = await service.listAppointmentAttendees(
        { id: reserved.map((a) => a.id) },
        { select: ["id", "status"], take: null }
      )
      if (after.some((a) => a.status === "cancelled")) {
        throw new MedusaError(MedusaError.Types.NOT_ALLOWED, EXPIRED)
      }
    }

    return new StepResponse({ checked: attendeeIds.length })
  }
)
