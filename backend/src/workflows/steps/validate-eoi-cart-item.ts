import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { InferTypeOf, ProductVariantDTO } from "@medusajs/framework/types"
import { EoiConfiguration } from "../../modules/expression-of-interest/models/eoi-configuration"
import calculateEoiAmount, { EoiValueType } from "../../utils/eoi-pricing"

export type ValidateEoiCartItemInput = {
  variant: ProductVariantDTO
  quantity: number
  eoi_configuration: InferTypeOf<typeof EoiConfiguration> | null
  // Items already in the cart, so a repeat add of the same EOI variant can be
  // rejected instead of silently merging into a quantity-2 line.
  cart_items?: { variant_id?: string | null; metadata?: Record<string, unknown> | null }[]
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
  async ({ variant, quantity, eoi_configuration, cart_items }: ValidateEoiCartItemInput) => {
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

    const alreadyInCart = (cart_items ?? []).some(
      (item) => item?.variant_id === variant.id && item?.metadata?.is_eoi === true
    )
    if (alreadyInCart) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Variant ${variant.id} is already in the cart as an Expression of Interest.`
      )
    }

    // A missing price must stop the add, not quote a free reservation: with
    // no calculated price the percentage maths below would charge 0.
    const unitPrice = Number((variant as any).calculated_price?.calculated_amount)
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Variant ${variant.id} has no price for this cart's region/currency, so an Expression of Interest cannot be quoted.`
      )
    }
    const valueType = eoi_configuration.value_type as EoiValueType
    const valueAmount = Number(eoi_configuration.value_amount)

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
