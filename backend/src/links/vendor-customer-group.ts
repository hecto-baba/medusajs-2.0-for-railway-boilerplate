import { defineLink } from "@medusajs/framework/utils"
import MarketplaceModule from "../modules/marketplace"
import CustomerModule from "@medusajs/medusa/customer"

/**
 * Links a Vendor to Customer Groups.
 * isList on the customer group side: a vendor can manage multiple customer groups.
 */
export default defineLink(
  {
    linkable: MarketplaceModule.linkable.vendor,
    deleteCascade: true,
  },
  {
    linkable: CustomerModule.linkable.customerGroup.id,
    isList: true,
  }
)
