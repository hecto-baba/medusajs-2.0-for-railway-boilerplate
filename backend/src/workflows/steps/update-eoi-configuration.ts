import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { EOI_MODULE } from "../../modules/expression-of-interest"
import {
  assertNoOtherSaleMode,
  getProductIdOfVariant,
  withSaleModeLock,
} from "../../lib/sale-mode"
import ExpressionOfInterestModuleService from "../../modules/expression-of-interest/service"

type UpdateEoiConfigurationInput = {
  id: string
  value_type?: "fixed" | "percentage"
  value_amount?: number
  status?: "active" | "inactive"
}

export const updateEoiConfigurationStep = createStep(
  "update-eoi-configuration",
  async (input: UpdateEoiConfigurationInput, { container }) => {
    const eoiModuleService: ExpressionOfInterestModuleService =
      container.resolve(EOI_MODULE)

    const existingEoiConfig = await eoiModuleService.retrieveEoiConfiguration(
      input.id
    )

    // Only a switch to "active" can create a conflict. Check and write share
    // a per-product lock so another mode cannot switch on between them.
    const productId =
      input.status === "active" && existingEoiConfig.status !== "active"
        ? await getProductIdOfVariant(container, existingEoiConfig.variant_id)
        : undefined

    const updatedEoiConfig = productId
      ? await withSaleModeLock(container, [productId], async () => {
          await assertNoOtherSaleMode(container, productId, "eoi")
          return eoiModuleService.updateEoiConfigurations(input)
        })
      : await eoiModuleService.updateEoiConfigurations(input)

    return new StepResponse(updatedEoiConfig, existingEoiConfig)
  },
  async (existingEoiConfig, { container }) => {
    if (!existingEoiConfig) return

    const eoiModuleService: ExpressionOfInterestModuleService =
      container.resolve(EOI_MODULE)

    await eoiModuleService.updateEoiConfigurations({
      id: existingEoiConfig.id,
      value_type: existingEoiConfig.value_type,
      value_amount: existingEoiConfig.value_amount,
      status: existingEoiConfig.status,
    })
  }
)
