import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { APPOINTMENT_BOOKING_MODULE } from "../../modules/appointment-booking"
import AppointmentBookingModuleService from "../../modules/appointment-booking/service"
import { validateException } from "../../modules/appointment-booking/lib/availability"
import { isUniqueViolation } from "../../modules/appointment-booking/lib/db-errors"

export type CreateAvailabilityExceptionStepInput = {
  provider_id: string
  date: Date
  type: "blackout" | "extra_hours"
  start_time?: string | null
  end_time?: string | null
  reason?: string | null
}

export const createAvailabilityExceptionStep = createStep(
  "create-availability-exception",
  async (input: CreateAvailabilityExceptionStepInput, { container }) => {
    const service: AppointmentBookingModuleService = container.resolve(
      APPOINTMENT_BOOKING_MODULE
    )

    const problem = validateException(input)
    if (problem) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, problem)
    }

    const [provider] = await service.listProviders(
      { id: input.provider_id },
      { select: ["id"], take: 1 }
    )
    if (!provider) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Resource not found.")
    }

    // The date is a calendar date, stored as UTC midnight of that date, so the
    // same holiday always has the same stored value however it was submitted.
    const date = new Date(`${new Date(input.date).toISOString().slice(0, 10)}T00:00:00.000Z`)
    const start_time = input.start_time || null
    const end_time = input.end_time || null

    const findIdentical = async () => {
      const sameDay = await service.listAvailabilityExceptions(
        { provider_id: input.provider_id, date, type: input.type },
        { take: null }
      )
      return sameDay.find(
        (e) => (e.start_time ?? null) === start_time && (e.end_time ?? null) === end_time
      )
    }

    // Idempotent: the same holiday submitted twice returns the existing row.
    const identical = await findIdentical()
    if (identical) {
      return new StepResponse(identical, undefined)
    }

    try {
      const exception = await service.createAvailabilityExceptions({
        provider_id: input.provider_id,
        date,
        type: input.type,
        start_time,
        end_time,
        reason: input.reason ?? null,
      })
      return new StepResponse(exception, exception.id)
    } catch (err) {
      if (!isUniqueViolation(err)) throw err
      const existing = await findIdentical()
      if (!existing) throw err
      return new StepResponse(existing, undefined)
    }
  },
  async (exceptionId, { container }) => {
    if (!exceptionId) return

    const service: AppointmentBookingModuleService = container.resolve(
      APPOINTMENT_BOOKING_MODULE
    )

    await service.deleteAvailabilityExceptions(exceptionId)
  }
)
