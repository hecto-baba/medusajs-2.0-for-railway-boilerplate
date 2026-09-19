import { defineLink } from "@medusajs/framework/utils"
import AppointmentBookingModule from "../modules/appointment-booking"
import MarketplaceModule from "../modules/marketplace"

export default defineLink(
  {
    linkable: AppointmentBookingModule.linkable.provider,
    field: "vendor_admin_id",
  },
  MarketplaceModule.linkable.vendorAdmin,
  {
    readOnly: true,
  }
)
