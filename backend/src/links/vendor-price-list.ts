import { defineLink } from "@medusajs/framework/utils"
import MarketplaceModule from "../modules/marketplace"
import PricingModule from "@medusajs/medusa/pricing"

/**
 * Links a Vendor to Price Lists.
 * isList on the price list side: a vendor can manage multiple price lists.
 * deleteCascade ensures orphaned link rows are removed when a vendor is deleted.
 */
export default defineLink(
  {
    linkable: MarketplaceModule.linkable.vendor,
    deleteCascade: true,
  },
  {
    linkable: PricingModule.linkable.priceList.id,
    isList: true,
  }
)
