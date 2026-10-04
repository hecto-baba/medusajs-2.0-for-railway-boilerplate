import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { EOI_MODULE } from "../../modules/expression-of-interest"
import {
  assertNoOtherSaleMode,
  getProductIdOfVariant,
  withSaleModeLock,
} from "../../lib/sale-mode"
import ExpressionOfInterestModuleService from "../../modules/expression-of-interest/service"

type CreateEoiConfigurationInput = {
  variant_id: string
  value_type?: "fixed" | "percentage"
  value_amount?: number
  status?: "active" | "inactive"
}

export const createEoiConfigurationStep = createStep(
  "create-eoi-configuration",
  async (input: CreateEoiConfigurationInput, { container }) => {
    const eoiModuleService: ExpressionOfInterestModuleService =
      container.resolve(EOI_MODULE)

    // value_amount is NOT NULL in the table: without this check a first POST
    // that omits it surfaces as an opaque 500 instead of a 400.
    if (typeof input.value_amount !== "number") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "value_amount is required when creating an EOI configuration."
      )
    }

    const write = () =>
      eoiModuleService.createEoiConfigurations({
        variant_id: input.variant_id,
        value_type: input.value_type,
        value_amount: input.value_amount,
        status: input.status,
      })

    // One sale mode per product: refused while enquiries (or another mode) is
    // active. EOI defaults to active when no status is sent. The lock is per
    // PRODUCT (not variant) so it queues with the other modes' writes; check
    // and write share it.
    const productId =
      input.status !== "inactive"
        ? await getProductIdOfVariant(container, input.variant_id)
        : undefined

    const eoiConfig = productId
      ? await withSaleModeLock(container, [productId], async () => {
          await assertNoOtherSaleMode(container, productId, "eoi")
          return write()
        })
      : await write()

    return new StepResponse(eoiConfig, eoiConfig.id)
  },
  async (eoiConfigId, { container }) => {
    if (!eoiConfigId) return

    const eoiModuleService: ExpressionOfInterestModuleService =
      container.resolve(EOI_MODULE)

    await eoiModuleService.deleteEoiConfigurations(eoiConfigId)
  }
)
