import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

/**
 * Show dates for a product, with how many seats remain on each.
 *
 * Remaining counts are derived from recorded purchases, so a seat another
 * shopper is holding in their cart still reads as available here. The seat is
 * only truly claimed once their cart completes; until then the first cart to
 * complete wins and the other is rejected at checkout.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
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
      "purchases.seat_number",
      "purchases.show_date",
    ],
    filters: { product_id: id },
  })

  if (!ticketProduct) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `No show found for product ${id}`
    )
  }

  const totalSeats = (ticketProduct.venue?.rows || []).reduce(
    (total: number, row: any) => total + row.seat_count,
    0
  )

  const availability = ((ticketProduct.dates as string[]) || []).map((date) => {
    const day = new Date(date).toDateString()

    const sold = (ticketProduct.purchases || []).filter(
      (purchase: any) =>
        purchase?.show_date &&
        new Date(purchase.show_date).toDateString() === day
    ).length

    return {
      date,
      total_seats: totalSeats,
      seats_sold: sold,
      seats_available: Math.max(totalSeats - sold, 0),
      is_sold_out: totalSeats > 0 && sold >= totalSeats,
    }
  })

  res.json({
    ticket_product: {
      id: ticketProduct.id,
      product_id: ticketProduct.product_id,
      venue: ticketProduct.venue,
    },
    availability,
  })
}
