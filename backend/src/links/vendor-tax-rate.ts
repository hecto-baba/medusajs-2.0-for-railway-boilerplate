import { defineLink } from "@medusajs/framework/utils"
import MarketplaceModule from "../modules/marketplace"
import TaxModule from "@medusajs/medusa/tax"

/**
 * Links a Vendor to the tax rates it owns.
 *
 * Seller tax uses Medusa's own rates and rules instead of a custom provider: a
 * seller rate is a non-default rate in a platform country tax region whose
 * rules name the seller's products and shipping options, so it applies only to
 * them. The platform rates (linked to no seller) stay the default for
 * everything else. See lib/vendor-tax.ts.
 */
export default defineLink(
  {
    linkable: MarketplaceModule.linkable.vendor,
    deleteCascade: true,
  },
  {
    linkable: TaxModule.linkable.taxRate.id,
    isList: true,
  }
)
