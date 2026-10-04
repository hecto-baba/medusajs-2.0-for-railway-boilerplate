import type { HttpTypes } from "@medusajs/types"

export type EoiValueType = "fixed" | "percentage"

type EoiConfigurationShape = {
  status?: string
  value_type?: EoiValueType
  value_amount?: number | string | null
  raw_value_amount?: { value?: string } | null
}

export type EoiQuote = {
  valueType: EoiValueType
  valueAmount: number
  /** Full price of the variant. */
  unitPrice: number
  /** What is charged now. */
  charged: number
  /** What is left to pay later. Tracked on the order, not charged at checkout. */
  remaining: number
  currencyCode: string
}

/**
 * The deposit rule, the same one the backend applies
 * (backend/src/utils/eoi-pricing.ts): a flat amount, or a percentage of the
 * unit price, never below zero and never above the price. Keeping the maths in
 * step means the figure shown here is the figure the cart will charge.
 */
export const calculateEoi = (
  unitPrice: number,
  valueType: EoiValueType,
  valueAmount: number
) => {
  const raw =
    valueType === "percentage" ? unitPrice * (valueAmount / 100) : valueAmount
  const charged = Math.min(Math.max(raw, 0), unitPrice)
  return { charged, remaining: Math.max(unitPrice - charged, 0) }
}

/**
 * The EOI quote for a variant, or null when the variant does not offer one
 * (no configuration, an inactive one, or no usable price).
 */
export const getEoiQuote = (
  variant: HttpTypes.StoreProductVariant | undefined
): EoiQuote | null => {
  const config = (variant as { eoi_configuration?: EoiConfigurationShape | null })
    ?.eoi_configuration

  if (!variant || config?.status !== "active" || !config.value_type) {
    return null
  }

  const unitPrice = Number(variant.calculated_price?.calculated_amount)
  const valueAmount = Number(
    config.value_amount ?? config.raw_value_amount?.value
  )

  if (
    !Number.isFinite(unitPrice) ||
    unitPrice <= 0 ||
    !Number.isFinite(valueAmount)
  ) {
    return null
  }

  return {
    valueType: config.value_type,
    valueAmount,
    unitPrice,
    currencyCode: variant.calculated_price?.currency_code ?? "",
    ...(() => {
      const { charged, remaining } = calculateEoi(
        unitPrice,
        config.value_type!,
        valueAmount
      )
      return { charged, remaining }
    })(),
  }
}
