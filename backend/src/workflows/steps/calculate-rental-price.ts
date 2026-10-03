import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import calculateRentalTotal, {
  RentalDepositType,
} from "../../utils/rental-pricing"

export type CalculateRentalPriceInput = {
  /** The variant's per-unit rate (e.g. price per day, per week, ...). */
  unit_rate: number
  /** How many units are being booked (e.g. 2 weeks). */
  units_count: number
  deposit_amount?: number
  deposit_type?: RentalDepositType
}

/**
 * Canonical step for turning a per-unit rate + quantity into a rental
 * subtotal and security deposit. Every workflow that needs a rental price
 * should call this step rather than repeating the multiplication inline, so
 * pricing behavior only has to be fixed in one place.
 */
export const calculateRentalPriceStep = createStep(
  "calculate-rental-price",
  async ({
    unit_rate,
    units_count,
    deposit_amount,
    deposit_type,
  }: CalculateRentalPriceInput) => {
    const result = calculateRentalTotal({
      unitRate: unit_rate,
      unitsCount: units_count,
      depositAmount: deposit_amount,
      depositType: deposit_type,
    })

    return new StepResponse(result)
  }
)
