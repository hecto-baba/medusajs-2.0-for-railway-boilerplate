import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { deleteProductsWorkflow } from "@medusajs/medusa/core-flows"
import { TICKET_BOOKING_MODULE } from "../../../../modules/ticket-booking"
import {
  assertVendorOwnsShow,
  transformVendorShow,
  VENDOR_SHOW_FIELDS,
} from "../helpers"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertVendorOwnsShow(req, id)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [ticketProduct],
  } = await query.graph({
    entity: "ticket_product",
    fields: [
      ...VENDOR_SHOW_FIELDS,
      "product.description",
      "product.variants.*",
      "product.variants.prices.*",
      "purchases.id",
      "purchases.order_id",
      "purchases.seat_number",
      "purchases.show_date",
      "purchases.status",
      "purchases.venue_row.id",
      "purchases.venue_row.row_number",
      "purchases.venue_row.row_type",
    ],
    filters: { id: [id] },
  })

  if (!ticketProduct) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Show not found.")
  }

  // Calculate performance statistics per date
  const venueRows = ticketProduct.venue?.rows || []
  const capacityPerPerformance = venueRows.reduce(
    (total: number, row: any) => total + (row.seat_count || 0),
    0
  )

  const purchases = (ticketProduct.purchases || []) as any[]

  const performanceStats = (ticketProduct.dates || []).map((dateStr: string) => {
    const targetDay = new Date(dateStr).toDateString()
    const datePurchases = purchases.filter(
      (p: any) => p.show_date && new Date(p.show_date).toDateString() === targetDay
    )

    const soldCount = datePurchases.length
    const availableCount = Math.max(0, capacityPerPerformance - soldCount)
    const scannedCount = datePurchases.filter((p: any) => p.status === "scanned").length

    return {
      date: dateStr,
      capacity: capacityPerPerformance,
      sold_count: soldCount,
      available_count: availableCount,
      scanned_count: scannedCount,
    }
  })

  res.json({
    show: {
      ...transformVendorShow(ticketProduct),
      performances: performanceStats,
      purchases,
    },
  })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertVendorOwnsShow(req, id)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [ticketProduct],
  } = await query.graph({
    entity: "ticket_product",
    fields: ["id", "product_id"],
    filters: { id: [id] },
  })

  if (!ticketProduct) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Show not found.")
  }

  const ticketBookingService = req.scope.resolve(TICKET_BOOKING_MODULE) as any

  // Delete ticket product
  await ticketBookingService.deleteTicketProducts([id])

  // Delete underlying product
  if (ticketProduct.product_id) {
    await deleteProductsWorkflow(req.scope).run({
      input: { ids: [ticketProduct.product_id] },
    })
  }

  res.json({
    id,
    object: "show",
    deleted: true,
  })
}
