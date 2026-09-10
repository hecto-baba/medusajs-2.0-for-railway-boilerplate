import { defineLink } from "@medusajs/framework/utils"
import TicketBookingModule from "../modules/ticket-booking"
import ProductModule from "@medusajs/medusa/product"

export default defineLink(
  {
    linkable: TicketBookingModule.linkable.ticketProductVariant,
    deleteCascade: true,
  },
  ProductModule.linkable.productVariant
)
