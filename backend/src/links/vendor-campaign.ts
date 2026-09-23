import { defineLink } from "@medusajs/framework/utils"
import MarketplaceModule from "../modules/marketplace"
import PromotionModule from "@medusajs/medusa/promotion"

/**
 * isList on the campaign side: a vendor can run many campaigns. Mirrors
 * vendor-promotion.ts - the link is written by create-vendor-campaign via
 * createRemoteLinkStep, and read when scoping a vendor admin's campaigns
 * through vendor.campaigns.*.
 *
 * A vendor only ever gets a link to a campaign it created itself (see
 * create-vendor-campaign.ts and vendors/campaigns/route.ts) - there is no
 * route that lets a vendor attach to a campaign it did not create, which is
 * what keeps this from exposing the platform's or another vendor's campaigns.
 */
export default defineLink(
  {
    linkable: MarketplaceModule.linkable.vendor,
    deleteCascade: true,
  },
  {
    linkable: PromotionModule.linkable.campaign.id,
    isList: true,
  }
)
