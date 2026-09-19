import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { APPOINTMENT_BOOKING_MODULE } from "../../modules/appointment-booking"
import AppointmentBookingModuleService from "../../modules/appointment-booking/service"

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

    if (input.type === "extra_hours" && (!input.start_time || !input.end_time)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `start_time and end_time are required for an "extra_hours" exception`
      )
    }

    const exception = await service.createAvailabilityExceptions(input)

    return new StepResponse(exception, exception.id)
  },
  async (exceptionId, { container }) => {
    if (!exceptionId) return

    const service: AppointmentBookingModuleService = container.resolve(
      APPOINTMENT_BOOKING_MODULE
    )

    await service.deleteAvailabilityExceptions(exceptionId)
  }
)
