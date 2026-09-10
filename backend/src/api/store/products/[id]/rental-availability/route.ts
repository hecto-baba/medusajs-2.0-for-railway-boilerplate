import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, QueryContext } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { RENTAL_MODULE } from "../../../../../modules/rental"
import RentalModuleService from "../../../../../modules/rental/service"
import validateRentalDates from "../../../../../utils/validate-rental-dates"
import countRentalDays from "../../../../../utils/count-rental-days"

export const GetRentalAvailabilitySchema = z.object({
  variant_id: z.string(),
  start_date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "start_date must be a valid date string (YYYY-MM-DD)",
  }),
  end_date: z
    .string()
    .optional()
    .refine((val) => val === undefined || !isNaN(Date.parse(val)), {
      message: "end_date must be a valid date string (YYYY-MM-DD)",
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
  
  // If no end_date provided, assume single day rental (same day)
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

  validateRentalDates(
    rentalStartDate, 
    rentalEndDate, 
    {
      min_rental_days: rentalConfig.min_rental_days,
      max_rental_days: rentalConfig.max_rental_days,
    }, 
    rentalDays
  )

  // Check if variant is already rented during the requested period
  const isAvailable = !await rentalModuleService.hasRentalOverlap(
    variant_id, 
    rentalStartDate, 
    rentalEndDate
  )
  let price = 0
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
    price = ((variant as any).calculated_price?.calculated_amount || 0) *
      rentalDays
  }

  res.json({
    available: isAvailable,
    price: {
      amount: price,
      currency_code: currency_code,
    }
  })
}

