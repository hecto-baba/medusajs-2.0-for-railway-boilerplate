import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { RENTAL_MODULE } from "../../modules/rental"
import RentalModuleService from "../../modules/rental/service"
import { InferTypeOf, ProductVariantDTO } from "@medusajs/framework/types"
import { RentalConfiguration } from "../../modules/rental/models/rental-configuration"
import hasCartOverlap from "../../utils/has-cart-overlap"
import validateRentalDates from "../../utils/validate-rental-dates"
import countRentalDays from "../../utils/count-rental-days"
import countRentalUnits from "../../utils/count-rental-units"
import calculateRentalTotal from "../../utils/rental-pricing"
import { RentalUnit } from "../../utils/rental-unit"

export type ValidateRentalCartItemInput = {
  variant: ProductVariantDTO
  quantity: number
  metadata?: Record<string, unknown>
  rental_configuration: InferTypeOf<typeof RentalConfiguration> | null
  existing_cart_items: {
    id: string
    variant_id: string
    metadata?: Record<string, unknown>
  }[]
}

export const validateRentalCartItemStep = createStep(
  "validate-rental-cart-item",
  async ({ 
    variant, 
    quantity, 
    metadata, 
    rental_configuration, 
    existing_cart_items
  }: ValidateRentalCartItemInput, { container }) => {
    const rentalModuleService: RentalModuleService = container.resolve(RENTAL_MODULE)

    // Skip validation if not a rental product or if rental config is not active
    if (rental_configuration?.status !== "active") {
      return new StepResponse({
        is_rental: false,
        rental_days: 0,
        rental_unit: "day" as RentalUnit,
        rental_units_count: 0,
        price: 0,
        deposit_amount: 0,
        fulfilment_modes: "both" as "both" | "pickup" | "delivery",
      })
    }

    // This is a rental product - validate quantity
    if (quantity !== 1) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Rental items must have a quantity of 1. Cannot add ${quantity} of variant ${variant.id}`
      )
    }

    // Validate metadata
    const rentalStartDate = metadata?.rental_start_date
    const rentalEndDate = metadata?.rental_end_date
    const rentalDays = metadata?.rental_days

    if (!rentalStartDate || !rentalEndDate || !rentalDays) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Rental product variant ${variant.id} requires rental_start_date, rental_end_date and rental_days in metadata`
      )
    }

    const startDate = new Date(rentalStartDate as string)
    const endDate = new Date(rentalEndDate as string)
    // Derived, never taken from the request: the client-supplied count sets
    // the price and is what min/max are checked against, so trusting it
    // would let a caller book any period at a single day's rate. For an
    // hour-unit rental, rentalStartDate/rentalEndDate carry real time-of-day
    // (not just a date), so this still reflects the true elapsed period.
    const days = countRentalDays(startDate, endDate)

    const rentalUnit: RentalUnit =
      (rental_configuration.rental_unit as RentalUnit) ?? "day"
    const unitsCount =
      rentalUnit === "day" || rentalUnit === "custom"
        ? days
        : countRentalUnits(startDate, endDate, rentalUnit)

    validateRentalDates(
      startDate,
      endDate,
      {
        min_rental_days: rental_configuration.min_rental_days,
        max_rental_days: rental_configuration.max_rental_days,
        rental_unit: rentalUnit,
        min_rental_units: rental_configuration.min_rental_units,
        max_rental_units: rental_configuration.max_rental_units,
      },
      days,
      unitsCount
    )

    // Check if this rental variant is already in the cart with overlapping dates
    const hasCartOverlapResult = hasCartOverlap(
      {
        variant_id: variant.id,
        rental_start_date: startDate,
        rental_end_date: endDate,
        rental_days: days,
      },
      existing_cart_items
    )

    if (hasCartOverlapResult) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Rental variant ${variant.id} is already in the cart with overlapping dates (${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]})`
      )
    }

    // Check availability for the requested period
    const hasOverlap = await rentalModuleService.hasRentalOverlap(variant.id, startDate, endDate)
    
    if (hasOverlap) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Variant ${variant.id} is already rented during the requested period (${startDate.toISOString()} to ${endDate.toISOString()})`
      )
    }

    const unitRate = (variant as any).calculated_price?.calculated_amount || 0
    const { subtotal, depositAmount } = calculateRentalTotal({
      unitRate,
      unitsCount,
      depositAmount: rental_configuration.security_deposit_amount ?? 0,
      depositType: rental_configuration.security_deposit_type as
        | "fixed"
        | "percentage"
        | undefined,
    })

    return new StepResponse({
      is_rental: true,
      rental_days: days,
      rental_unit: rentalUnit,
      rental_units_count: unitsCount,
      price: subtotal,
      deposit_amount: depositAmount,
      // How the seller lets this product reach the renter, so the add-to-cart
      // workflow can settle pickup versus delivery from the server's own
      // configuration instead of trusting the client's choice alone.
      fulfilment_modes: ((rental_configuration as any).fulfilment_modes ??
        "both") as "both" | "pickup" | "delivery",
    })
  }
)

