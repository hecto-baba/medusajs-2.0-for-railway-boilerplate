import { defineLink } from "@medusajs/framework/utils"
import TicketBookingModule from "../modules/ticket-booking"
import ProductModule from "@medusajs/medusa/product"

/**
 * Unlike the rental links, these are real link tables rather than read-only
 * joins on a text column: createRemoteLinkStep writes them during show
 * creation, and the order-placed subscriber traverses them to reach a
 * purchase's product.
 */
export default defineLink(
  {
    linkable: TicketBookingModule.linkable.ticketProduct,
    deleteCascade: true,
  },
  ProductModule.linkable.product
)
