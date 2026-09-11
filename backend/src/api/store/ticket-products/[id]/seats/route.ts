import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  DATE_OPTION,
  ROW_TYPE_OPTION,
} from "../../../../../workflows/create-ticket-product"

export const GetTicketProductSeatsSchema = z.object({
  date: z.string().refine((value) => !isNaN(Date.parse(value)), {
    message: "date must be a valid date string",
  }),
})

/**
 * The seat map for one show date: every row, every seat, and whether it has
 * been sold, along with the variant a seat must be bought through.
 *
 * Seats held in someone else's open cart are reported as available - see the
 * availability route for why.
 */
export const GET = async (
  req: MedusaRequest<{}, z.infer<typeof GetTicketProductSeatsSchema>>,
  res: MedusaResponse
) => {
  const { id } = req.params
  const { date } = req.validatedQuery
  const query = req.scope.resolve("query")

  const {
    data: [ticketProduct],
  } = await query.graph({
    entity: "ticket_product",
    fields: [
      "id",
      "product_id",
      "dates",
      "venue.id",
      "venue.name",
      "venue.address",
      "venue.rows.*",
      "variants.id",
      "variants.row_type",
      "variants.product_variant.id",
      "variants.product_variant.options.value",
      "variants.product_variant.options.option.title",
      "purchases.seat_number",
      "purchases.show_date",
      "purchases.venue_row_id",
    ],
    filters: { product_id: id },
  })

  if (!ticketProduct) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `No show found for product ${id}`
    )
  }

  const requestedDay = new Date(date).toDateString()

  const isShowDate = ((ticketProduct.dates as string[]) || []).some(
    (showDate) => new Date(showDate).toDateString() === requestedDay
  )

  if (!isShowDate) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `This show has no performance on ${date}`
    )
  }

  // Seats sold for this date, keyed by row so lookup stays O(1) per seat.
  const soldByRow = new Map<string, Set<string>>()

  for (const purchase of (ticketProduct.purchases || []) as any[]) {
    if (
      !purchase?.show_date ||
      new Date(purchase.show_date).toDateString() !== requestedDay
    ) {
      continue
    }

    const rowId = purchase.venue_row_id as string
    const seats = soldByRow.get(rowId) ?? new Set<string>()
    seats.add(purchase.seat_number)
    soldByRow.set(rowId, seats)
  }

  const seatMap = ((ticketProduct.venue?.rows || []) as any[]).map((row) => {
    // Match this row to the variant carrying the same date and row type,
    // which is the variant the seat must be added to the cart through.
    const ticketVariant = ((ticketProduct.variants || []) as any[]).find(
      (variant) => {
        const options = variant.product_variant?.options || []

        const variantDate = options.find(
          (option: any) => option.option?.title === DATE_OPTION
        )?.value

        const variantRowType = options.find(
          (option: any) => option.option?.title === ROW_TYPE_OPTION
        )?.value

        return (
          variantDate !== undefined &&
          new Date(variantDate).toDateString() === requestedDay &&
          variantRowType === row.row_type
        )
      }
    )

    const sold = soldByRow.get(row.id) ?? new Set<string>()

    const seats = Array.from({ length: row.seat_count }, (_, index) => {
      const seatNumber = (index + 1).toString()

      return {
        seat_number: seatNumber,
        is_available: !sold.has(seatNumber),
      }
    })

    return {
      venue_row_id: row.id,
      row_number: row.row_number,
      row_type: row.row_type,
      seat_count: row.seat_count,
      variant_id: ticketVariant?.product_variant?.id ?? null,
      seats,
    }
  })

  res.json({
    date,
    venue: ticketProduct.venue,
    seat_map: seatMap,
  })
}
