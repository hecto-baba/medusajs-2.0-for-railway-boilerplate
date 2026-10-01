export type EoiValueType = "fixed" | "percentage"

export type CalculateEoiAmountInput = {
  unitPrice: number
  valueType: EoiValueType
  valueAmount: number
}

export type CalculateEoiAmountResult = {
  eoi_charged_amount: number
  remaining_amount: number
}

/**
 * The fixed/percentage math, centralized. Every caller - the add-to-cart
 * step below, and any future admin "preview EOI amount" UI - calls this one
 * function, rather than duplicating the multiplication inline (unlike
 * rental, where calculateRentalPriceStep exists but validate-rental-cart-item.ts
 * duplicates the same logic inline - not a split worth repeating here).
 */
export function calculateEoiAmount({
  unitPrice,
  valueType,
  valueAmount,
}: CalculateEoiAmountInput): CalculateEoiAmountResult {
  const eoiChargedAmount =
    valueType === "percentage" ? unitPrice * (valueAmount / 100) : valueAmount

  return {
    eoi_charged_amount: eoiChargedAmount,
    remaining_amount: Math.max(unitPrice - eoiChargedAmount, 0),
  }
}

export default calculateEoiAmount
