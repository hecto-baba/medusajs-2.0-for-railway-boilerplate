import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { RENTAL_MODULE } from "../../modules/rental"
import RentalModuleService from "../../modules/rental/service"
import { RentalUnit } from "../../utils/rental-unit"

type CreateRentalConfigurationInput = {
  product_id: string
  min_rental_days?: number
  max_rental_days?: number | null
  rental_unit?: RentalUnit
  min_rental_units?: number
  max_rental_units?: number | null
  security_deposit_amount?: number
  security_deposit_type?: "fixed" | "percentage"
  requires_time_selection?: boolean
  status?: "active" | "inactive"
}

export const createRentalConfigurationStep = createStep(
  "create-rental-configuration",
  async (
    input: CreateRentalConfigurationInput,
    { container }
  ) => {
    const rentalModuleService: RentalModuleService = container.resolve(
      RENTAL_MODULE
    )

    // Backward-compatible: a caller that only sends the legacy day fields
    // (min_rental_days/max_rental_days) gets a day-unit configuration whose
    // new *_units columns mirror those values, so it behaves identically to
    // configurations created before this workflow understood units.
    const rentalUnit = input.rental_unit ?? "day"
    const minUnits = input.min_rental_units ?? input.min_rental_days
    const maxUnits =
      input.max_rental_units !== undefined
        ? input.max_rental_units
        : input.max_rental_days

    const rentalConfig = await rentalModuleService.createRentalConfigurations({
      product_id: input.product_id,
      min_rental_days: input.min_rental_days,
      max_rental_days: input.max_rental_days,
      rental_unit: rentalUnit,
      min_rental_units: minUnits,
      max_rental_units: maxUnits,
      security_deposit_amount: input.security_deposit_amount,
      security_deposit_type: input.security_deposit_type,
      requires_time_selection: input.requires_time_selection,
      status: input.status,
    })

    return new StepResponse(rentalConfig, rentalConfig.id)
  },
  async (rentalConfigId, { container }) => {
    if (!rentalConfigId) return

    const rentalModuleService: RentalModuleService = container.resolve(
      RENTAL_MODULE
    )

    // Delete the created configuration on rollback
    await rentalModuleService.deleteRentalConfigurations(rentalConfigId)
  }
)

