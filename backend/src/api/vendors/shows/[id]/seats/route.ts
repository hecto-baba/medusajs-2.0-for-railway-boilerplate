import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  DATE_OPTION,
  ROW_TYPE_OPTION,
} from "../../../../../workflows/create-ticket-product"
import { assertVendorOwnsShow } from "../../helpers"

export const GetVendorShowSeatsSchema = z.object({
  date: z.string().refine((value) => !isNaN(Date.parse(value)), {
    message: "date must be a valid date string",
  }),
})

export const GET = async (
  req: AuthenticatedMedusaRequest<{}, z.infer<typeof GetVendorShowSeatsSchema>>,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertVendorOwnsShow(req, id)

  const dateParam = (req.query?.date as string) || (req.validatedQuery as any)?.date
  if (!dateParam || isNaN(Date.parse(dateParam))) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "A valid date query parameter is required"
    )
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

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
      "purchases.id",
      "purchases.order_id",
      "purchases.seat_number",
      "purchases.show_date",
      "purchases.venue_row_id",
      "purchases.status",
    ],
    filters: { id: [id] },
  })

  if (!ticketProduct) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Show not found.")
  }

  const requestedDay = new Date(dateParam).toDateString()

  const isShowDate = ((ticketProduct.dates as string[]) || []).some(
    (showDate) => new Date(showDate).toDateString() === requestedDay
  )

  if (!isShowDate) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `This show has no performance scheduled on ${dateParam}`
    )
  }

  // Map purchases for this show date by row ID
  const purchasesByRow = new Map<string, Map<string, any>>()

  for (const purchase of (ticketProduct.purchases || []) as any[]) {
    if (
      !purchase?.show_date ||
      new Date(purchase.show_date).toDateString() !== requestedDay
    ) {
      continue
    }

    const rowId = purchase.venue_row_id as string
    const seatsMap = purchasesByRow.get(rowId) ?? new Map<string, any>()
    seatsMap.set(purchase.seat_number, purchase)
    purchasesByRow.set(rowId, seatsMap)
  }

  const seatMap = ((ticketProduct.venue?.rows || []) as any[]).map((row) => {
    const rowPurchases = purchasesByRow.get(row.id) ?? new Map<string, any>()

    const seats = Array.from({ length: row.seat_count }, (_, index) => {
      const seatNumber = (index + 1).toString()
      const purchase = rowPurchases.get(seatNumber)

      return {
        seat_number: seatNumber,
        is_available: !purchase,
        purchase_id: purchase?.id ?? null,
        order_id: purchase?.order_id ?? null,
        status: purchase?.status ?? null,
      }
    })

    return {
      venue_row_id: row.id,
      row_number: row.row_number,
      row_type: row.row_type,
      seat_count: row.seat_count,
      seats,
    }
  })

  res.json({
    date: dateParam,
    venue: ticketProduct.venue,
    seat_map: seatMap,
  })
}
