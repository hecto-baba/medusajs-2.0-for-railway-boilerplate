import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { APPOINTMENT_BOOKING_MODULE } from "../../modules/appointment-booking"
import AppointmentBookingModuleService from "../../modules/appointment-booking/service"

export type CreateAppointmentSlotsStepInput = {
  provider_id: string
  service_product_id: string
  service_variant_id?: string | null
  service_duration_minutes: number
  max_capacity?: number
  date_from: Date
  date_to: Date
}

export const createAppointmentSlotsStep = createStep(
  "create-appointment-slots",
  async (input: CreateAppointmentSlotsStepInput, { container }) => {
    const service: AppointmentBookingModuleService = container.resolve(
      APPOINTMENT_BOOKING_MODULE
    )

    const slots = await service.expandAvailableSlots(
      input.provider_id,
      input.service_duration_minutes,
      input.date_from,
      input.date_to
    )

    if (!slots.length) {
      return new StepResponse([], [])
    }

    // Inserted one at a time rather than as a single bulk create: two
    // concurrent "generate slots" calls (two clicks, two staff members) can
    // both compute an overlapping window from the same read of
    // expandAvailableSlots, then race to insert it. The appointment_no_overlap
    // exclusion constraint is what actually prevents the duplicate, but a
    // bulk insert fails its ENTIRE batch on one conflicting row - confirmed
    // live (one concurrent request 200s, the other 500s with no created
    // slots at all). Per-row inserts let a call that "lost the race" on some
    // slots still keep the ones that didn't conflict, and treat an
    // already-taken slot as an expected skip rather than a workflow failure.
    const created: Awaited<ReturnType<typeof service.createAppointments>> = []

    for (const slot of slots) {
      try {
        const [appointment] = await service.createAppointments([
          {
            provider_id: input.provider_id,
            service_product_id: input.service_product_id,
            service_variant_id: input.service_variant_id ?? null,
            start_time: slot.start,
            end_time: slot.end,
            max_capacity: input.max_capacity ?? 1,
            status: "available" as const,
          },
        ])
        created.push(appointment)
      } catch (err: any) {
        if (err?.code === "23P01") {
          // Already exists (created by this same call's earlier slot, a
          // concurrent request, or an existing booking) - not an error.
          continue
        }
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          `Could not create appointment slot ${slot.start.toISOString()}: ${err?.message ?? err}`
        )
      }
    }

    const createdIds = created.map((a) => a.id)

    return new StepResponse(created, createdIds)
  },
  async (createdIds, { container }) => {
    if (!createdIds?.length) return

    const service: AppointmentBookingModuleService = container.resolve(
      APPOINTMENT_BOOKING_MODULE
    )

    await service.deleteAppointments(createdIds)
  }
)
