import { defineLink } from "@medusajs/framework/utils"
import MarketplaceModule from "../modules/marketplace"
import PromotionModule from "@medusajs/medusa/promotion"

/**
 * isList on the promotion side: a vendor runs many promotions. The link is
 * written by the vendor-promotion workflow via createRemoteLinkStep, and read
 * when scoping a vendor admin's promotions through vendor.promotions.*.
 *
 * deleteCascade drops the link rows with the vendor rather than stranding
 * them; the promotions themselves are owned by the Promotion module and
 * survive.
 */
export default defineLink(
  {
    linkable: MarketplaceModule.linkable.vendor,
    deleteCascade: true,
  },
  {
    linkable: PromotionModule.linkable.promotion.id,
    isList: true,
  }
)
