import { defineLink } from "@medusajs/framework/utils"
import MarketplaceModule from "../modules/marketplace"
import FulfillmentModule from "@medusajs/medusa/fulfillment"

/**
 * Links a Vendor to the ShippingProfiles it owns.
 *
 * A profile linked to NO vendor is a shared platform profile: sellers can see
 * and use it but cannot edit or delete it.
 */
export default defineLink(
  {
    linkable: MarketplaceModule.linkable.vendor,
    deleteCascade: true,
  },
  {
    linkable: FulfillmentModule.linkable.shippingProfile.id,
    isList: true,
  }
)
