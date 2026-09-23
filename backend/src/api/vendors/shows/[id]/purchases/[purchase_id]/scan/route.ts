import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { TICKET_BOOKING_MODULE } from "../../../../../../../modules/ticket-booking"
import { assertVendorOwnsShow } from "../../../../helpers"

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id, purchase_id } = req.params
  await assertVendorOwnsShow(req, id)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [purchase],
  } = await query.graph({
    entity: "ticket_purchase",
    fields: ["id", "ticket_product_id", "status", "seat_number", "show_date"],
    filters: {
      id: [purchase_id],
      ticket_product_id: [id],
    },
  })

  if (!purchase) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Ticket purchase not found for this show."
    )
  }

  const ticketBookingService = req.scope.resolve(TICKET_BOOKING_MODULE) as any
  const nextStatus = purchase.status === "scanned" ? "pending" : "scanned"

  await ticketBookingService.updateTicketPurchases({
    id: purchase_id,
    status: nextStatus,
  })

  res.json({
    purchase: {
      ...purchase,
      status: nextStatus,
    },
    message:
      nextStatus === "scanned"
        ? "Ticket scanned and attendee checked in."
        : "Ticket marked as pending.",
  })
}
