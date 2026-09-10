import { defineLink } from "@medusajs/framework/utils"
import TicketBookingModule from "../modules/ticket-booking"
import OrderModule from "@medusajs/medusa/order"

// isList: one order carries every seat bought in that transaction.
export default defineLink(
  {
    linkable: TicketBookingModule.linkable.ticketPurchase,
    deleteCascade: true,
    isList: true,
  },
  OrderModule.linkable.order
)
