import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { RENTAL_MODULE } from "../../../../../modules/rental"
import RentalModuleService from "../../../../../modules/rental/service"

export const GetRentalBlockedDatesSchema = z.object({
  variant_id: z.string(),
  from: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "from must be a valid date string",
  }),
  to: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "to must be a valid date string",
  }),
})

/**
 * Lists already-booked date ranges for a variant within a window, so the
 * storefront calendar can strike through unavailable dates before the
 * shopper picks anything - rather than only finding out a chosen range is
 * taken after submitting it (which rental-availability still guards, as the
 * source of truth re-checked under a lock at add-to-cart and checkout).
 */
export const GET = async (
  req: MedusaRequest<{}, z.infer<typeof GetRentalBlockedDatesSchema>>,
  res: MedusaResponse
) => {
  const { variant_id, from, to } = req.validatedQuery

  const rentalModuleService: RentalModuleService = req.scope.resolve(
    RENTAL_MODULE
  )

  const windowStart = new Date(from)
  const windowEnd = new Date(to)

  const bookedRanges = await rentalModuleService.listBookedRanges(
    variant_id,
    windowStart,
    windowEnd
  )

  res.json({
    booked_ranges: bookedRanges.map((range) => ({
      start_date: range.start_date.toISOString(),
      end_date: range.end_date.toISOString(),
    })),
  })
}
