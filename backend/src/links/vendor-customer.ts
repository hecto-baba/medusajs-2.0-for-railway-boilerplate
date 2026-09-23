import { defineLink } from "@medusajs/framework/utils"
import MarketplaceModule from "../modules/marketplace"
import CustomerModule from "@medusajs/medusa/customer"

/**
 * Links a Vendor to Customers.
 * isList on the customer side: a vendor has many customers.
 * deleteCascade ensures orphaned link rows are removed when a vendor is deleted.
 */
export default defineLink(
  {
    linkable: MarketplaceModule.linkable.vendor,
    deleteCascade: true,
  },
  {
    linkable: CustomerModule.linkable.customer.id,
    isList: true,
  }
)
