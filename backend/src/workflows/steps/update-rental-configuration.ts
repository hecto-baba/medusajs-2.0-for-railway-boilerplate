import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { RENTAL_MODULE } from "../../modules/rental"
import RentalModuleService from "../../modules/rental/service"
import { assertNoOtherSaleMode, withSaleModeLock } from "../../lib/sale-mode"
import { RentalUnit } from "../../utils/rental-unit"

type UpdateRentalConfigurationInput = {
  id: string
  min_rental_days?: number
  max_rental_days?: number | null
  rental_unit?: RentalUnit
  min_rental_units?: number
  max_rental_units?: number | null
  security_deposit_amount?: number
  security_deposit_type?: "fixed" | "percentage"
  requires_time_selection?: boolean
  fulfilment_modes?: "both" | "pickup" | "delivery"
  status?: "active" | "inactive"
}

export const updateRentalConfigurationStep = createStep(
  "update-rental-configuration",
  async (
    input: UpdateRentalConfigurationInput,
    { container }
  ) => {
    const rentalModuleService: RentalModuleService = container.resolve(RENTAL_MODULE)

    // retrieve existing rental configuration
    const existingRentalConfig = await rentalModuleService.retrieveRentalConfiguration(
      input.id
    )

    // Backward-compatible: if only legacy day fields are sent, mirror them
    // into the new *_units columns instead of leaving those columns stale.
    const patch: Record<string, unknown> = { id: input.id, ...input }
    if (
      (input.min_rental_days !== undefined || input.max_rental_days !== undefined) &&
      input.min_rental_units === undefined &&
      input.max_rental_units === undefined &&
      input.rental_unit === undefined
    ) {
      patch.min_rental_units = input.min_rental_days
      patch.max_rental_units = input.max_rental_days
    }

    const write = () =>
      rentalModuleService.updateRentalConfigurations(
        patch as UpdateRentalConfigurationInput
      )

    // Only a switch to "active" can create a conflict; edits to an already
    // active rental must keep working. Check and write share one lock.
    const updatedRentalConfig =
      input.status === "active" && existingRentalConfig.status !== "active"
        ? await withSaleModeLock(container, [existingRentalConfig.product_id], async () => {
            await assertNoOtherSaleMode(container, existingRentalConfig.product_id, "rental")
            return write()
          })
        : await write()

    return new StepResponse(updatedRentalConfig, existingRentalConfig)
  },
  async (existingRentalConfig, { container }) => {
    if (!existingRentalConfig) return

    const rentalModuleService: RentalModuleService = container.resolve(RENTAL_MODULE)

    await rentalModuleService.updateRentalConfigurations({
      id: existingRentalConfig.id,
      min_rental_days: existingRentalConfig.min_rental_days,
      max_rental_days: existingRentalConfig.max_rental_days,
      rental_unit: existingRentalConfig.rental_unit,
      min_rental_units: existingRentalConfig.min_rental_units,
      max_rental_units: existingRentalConfig.max_rental_units,
      security_deposit_amount: existingRentalConfig.security_deposit_amount,
      security_deposit_type: existingRentalConfig.security_deposit_type,
      requires_time_selection: existingRentalConfig.requires_time_selection,
      fulfilment_modes: existingRentalConfig.fulfilment_modes,
      status: existingRentalConfig.status,
    })
  }
)

