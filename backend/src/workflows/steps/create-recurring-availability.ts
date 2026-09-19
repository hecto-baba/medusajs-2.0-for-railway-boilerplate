import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { APPOINTMENT_BOOKING_MODULE } from "../../modules/appointment-booking"
import AppointmentBookingModuleService from "../../modules/appointment-booking/service"

export type CreateRecurringAvailabilityStepInput = {
  provider_id: string
  day_of_week: number
  start_time: string
  end_time: string
  effective_from: Date
  effective_until?: Date | null
}

function timeToMinutes(time: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time)
  if (!match) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Invalid time "${time}", expected "HH:mm"`
    )
  }
  return Number(match[1]) * 60 + Number(match[2])
}

export const createRecurringAvailabilityStep = createStep(
  "create-recurring-availability",
  async (input: CreateRecurringAvailabilityStepInput, { container }) => {
    const service: AppointmentBookingModuleService = container.resolve(
      APPOINTMENT_BOOKING_MODULE
    )

    if (input.day_of_week < 0 || input.day_of_week > 6) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `day_of_week must be between 0 and 6, got ${input.day_of_week}`
      )
    }

    if (timeToMinutes(input.start_time) >= timeToMinutes(input.end_time)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `start_time must be before end_time`
      )
    }

    const rule = await service.createRecurringAvailabilities(input)

    return new StepResponse(rule, rule.id)
  },
  async (ruleId, { container }) => {
    if (!ruleId) return

    const service: AppointmentBookingModuleService = container.resolve(
      APPOINTMENT_BOOKING_MODULE
    )

    await service.deleteRecurringAvailabilities(ruleId)
  }
)
