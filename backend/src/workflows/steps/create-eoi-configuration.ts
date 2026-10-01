import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { EOI_MODULE } from "../../modules/expression-of-interest"
import ExpressionOfInterestModuleService from "../../modules/expression-of-interest/service"

type CreateEoiConfigurationInput = {
  product_id: string
  value_type?: "fixed" | "percentage"
  value_amount?: number
  status?: "active" | "inactive"
}

export const createEoiConfigurationStep = createStep(
  "create-eoi-configuration",
  async (input: CreateEoiConfigurationInput, { container }) => {
    const eoiModuleService: ExpressionOfInterestModuleService =
      container.resolve(EOI_MODULE)

    const eoiConfig = await eoiModuleService.createEoiConfigurations({
      product_id: input.product_id,
      value_type: input.value_type,
      value_amount: input.value_amount,
      status: input.status,
    })

    return new StepResponse(eoiConfig, eoiConfig.id)
  },
  async (eoiConfigId, { container }) => {
    if (!eoiConfigId) return

    const eoiModuleService: ExpressionOfInterestModuleService =
      container.resolve(EOI_MODULE)

    await eoiModuleService.deleteEoiConfigurations(eoiConfigId)
  }
)
