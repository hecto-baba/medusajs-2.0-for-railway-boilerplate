import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, QueryContext } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { RENTAL_MODULE } from "../../../../../modules/rental"
import RentalModuleService from "../../../../../modules/rental/service"
import validateRentalDates from "../../../../../utils/validate-rental-dates"
import countRentalDays from "../../../../../utils/count-rental-days"
import countRentalUnits from "../../../../../utils/count-rental-units"
import calculateRentalTotal from "../../../../../utils/rental-pricing"
import { RentalUnit } from "../../../../../utils/rental-unit"

// Accepts either a plain "YYYY-MM-DD" (day/week/month/custom units) or a full
// ISO datetime (hour units, where the time-of-day carries the actual booked
// range) - Date.parse handles both, so one schema covers both shapes.
export const GetRentalAvailabilitySchema = z.object({
  variant_id: z.string(),
  start_date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "start_date must be a valid date or datetime string",
  }),
  end_date: z
    .string()
    .optional()
    .refine((val) => val === undefined || !isNaN(Date.parse(val)), {
      message: "end_date must be a valid date or datetime string",
    }),
  currency_code: z.string().optional(),
})

export const GET = async (
  req: MedusaRequest<{}, z.infer<typeof GetRentalAvailabilitySchema>>, 
  res: MedusaResponse
) => {
  
  const { id: productId } = req.params
 
  const { 
    variant_id, 
    start_date, 
    end_date,
    currency_code
  } = req.validatedQuery

  const query = req.scope.resolve("query")
  const rentalModuleService: RentalModuleService = req.scope.resolve(
    RENTAL_MODULE
  )

  // Parse dates
  const rentalStartDate = new Date(start_date)
  const rentalEndDate = end_date ? new Date(end_date) : new Date(rentalStartDate)

  // If no end_date provided, assume single day rental (same day). This only
  // applies to date-only (day/week/month/custom) callers - an hour-unit
  // booking always sends both start_date and end_date as full datetimes, so
  // this UTC-midnight snap never runs for it.
  // Left at UTC midnight rather than pushed to a local end-of-day: the
  // start is UTC midnight too, and mixing the two made a one-day rental
  // span more than 24 hours and count as two.
  if (!end_date) {
    rentalEndDate.setUTCHours(0, 0, 0, 0)
  }

  // Get active rental configuration for the product
  const { data: [rentalConfig] } = await query.graph({
    entity: "rental_configuration",
    fields: ["*"],
    filters: { 
      product_id: productId,
      status: "active",
    },
  })

  if (!rentalConfig) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "product is not rentable"
    )
  }

  const rentalDays = countRentalDays(rentalStartDate, rentalEndDate) // +1 to include both start and end date

  const rentalUnit: RentalUnit = (rentalConfig.rental_unit as RentalUnit) ?? "day"
  // Hour-unit callers always send both start_date and end_date as full
  // datetimes (not just dates), so this reaches countRentalUnits and gets a
  // real elapsed-hours count instead of being aliased to rentalDays.
  const unitsCount =
    rentalUnit === "day" || rentalUnit === "custom"
      ? rentalDays
      : countRentalUnits(rentalStartDate, rentalEndDate, rentalUnit)

  validateRentalDates(
    rentalStartDate,
    rentalEndDate,
    {
      min_rental_days: rentalConfig.min_rental_days,
      max_rental_days: rentalConfig.max_rental_days,
      rental_unit: rentalUnit,
      min_rental_units: rentalConfig.min_rental_units,
      max_rental_units: rentalConfig.max_rental_units,
    },
    rentalDays,
    unitsCount
  )

  // Check if variant is already rented during the requested period
  const isAvailable = !await rentalModuleService.hasRentalOverlap(
    variant_id,
    rentalStartDate,
    rentalEndDate
  )
  let price = 0
  let depositAmount = 0
  if (isAvailable && currency_code) {
    const { data: [variant] } = await query.graph({
      entity: "product_variant",
      fields: ["calculated_price.*"],
      filters: {
        id: variant_id,
      },
      context: {
        calculated_price: QueryContext({
          currency_code: currency_code,
        }),
      },
    })
    const unitRate = (variant as any).calculated_price?.calculated_amount || 0
    const result = calculateRentalTotal({
      unitRate,
      unitsCount,
      depositAmount: rentalConfig.security_deposit_amount ?? 0,
      depositType: rentalConfig.security_deposit_type as
        | "fixed"
        | "percentage"
        | undefined,
    })
    price = result.subtotal
    depositAmount = result.depositAmount
  }

  res.json({
    available: isAvailable,
    price: {
      amount: price,
      currency_code: currency_code,
    },
    deposit: {
      amount: depositAmount,
      type: rentalConfig.security_deposit_type ?? "fixed",
      currency_code: currency_code,
    },
  })
}

