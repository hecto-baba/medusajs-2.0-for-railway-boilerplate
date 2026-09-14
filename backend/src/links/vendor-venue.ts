import { defineLink } from "@medusajs/framework/utils"
import MarketplaceModule from "../modules/marketplace"
import TicketBookingModule from "../modules/ticket-booking"

/**
 * Links a Vendor to Venues.
 * isList on the venue side: a vendor can manage multiple venues.
 * deleteCascade ensures orphaned link rows are removed when a vendor is deleted.
 */
export default defineLink(
  {
    linkable: MarketplaceModule.linkable.vendor,
    deleteCascade: true,
  },
  {
    linkable: TicketBookingModule.linkable.venue.id,
    isList: true,
  }
)
