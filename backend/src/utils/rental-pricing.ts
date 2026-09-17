export type RentalDepositType = "fixed" | "percentage"

export type CalculateRentalTotalInput = {
  /** The variant's per-unit rate (e.g. price per day, per week, ...). */
  unitRate: number
  /** How many units are being booked (e.g. 2 weeks). */
  unitsCount: number
  depositAmount?: number
  depositType?: RentalDepositType
}

export type CalculateRentalTotalResult = {
  subtotal: number
  depositAmount: number
  total: number
}

/**
 * Single source of truth for turning a per-unit rate + quantity into a
 * rental subtotal, plus the security deposit due alongside it. The deposit
 * is always returned separately from the subtotal - it is charged as its
 * own cart line item, never folded into unit_price, so it can be refunded
 * independently of the rental fee.
 */
export default function calculateRentalTotal({
  unitRate,
  unitsCount,
  depositAmount = 0,
  depositType = "fixed",
}: CalculateRentalTotalInput): CalculateRentalTotalResult {
  const subtotal = unitRate * unitsCount

  const resolvedDeposit =
    depositType === "percentage" ? subtotal * (depositAmount / 100) : depositAmount

  return {
    subtotal,
    depositAmount: resolvedDeposit,
    total: subtotal + resolvedDeposit,
  }
}
