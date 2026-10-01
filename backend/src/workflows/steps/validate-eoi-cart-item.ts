import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { InferTypeOf, ProductVariantDTO } from "@medusajs/framework/types"
import { EoiConfiguration } from "../../modules/expression-of-interest/models/eoi-configuration"
import calculateEoiAmount, { EoiValueType } from "../../utils/eoi-pricing"

export type ValidateEoiCartItemInput = {
  variant: ProductVariantDTO
  quantity: number
  eoi_configuration: InferTypeOf<typeof EoiConfiguration> | null
}

export type ValidateEoiCartItemOutput = {
  is_eoi: boolean
  value_type: EoiValueType
  value_amount: number
  quoted_unit_price: number
  eoi_charged_amount: number
  remaining_amount: number
}

/**
 * Mirrors validate-rental-cart-item.ts's shape: given a variant (with
 * product.eoi_configuration.* and calculated_price.* already loaded by the
 * caller) and the linked config, returns the resolved EOI price if the
 * config is active, else a pass-through signal so the caller adds a
 * normal-priced item.
 */
export const validateEoiCartItemStep = createStep(
  "validate-eoi-cart-item",
  async ({ variant, quantity, eoi_configuration }: ValidateEoiCartItemInput) => {
    if (eoi_configuration?.status !== "active") {
      return new StepResponse({
        is_eoi: false,
        value_type: "percentage" as EoiValueType,
        value_amount: 0,
        quoted_unit_price: 0,
        eoi_charged_amount: 0,
        remaining_amount: 0,
      })
    }

    if (quantity !== 1) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Expression of Interest items must have a quantity of 1. Cannot add ${quantity} of variant ${variant.id}`
      )
    }

    const unitPrice = (variant as any).calculated_price?.calculated_amount || 0
    const valueType = eoi_configuration.value_type as EoiValueType
    const valueAmount = eoi_configuration.value_amount as unknown as number

    const { eoi_charged_amount, remaining_amount } = calculateEoiAmount({
      unitPrice,
      valueType,
      valueAmount,
    })

    return new StepResponse({
      is_eoi: true,
      value_type: valueType,
      value_amount: valueAmount,
      quoted_unit_price: unitPrice,
      eoi_charged_amount,
      remaining_amount,
    })
  }
)
