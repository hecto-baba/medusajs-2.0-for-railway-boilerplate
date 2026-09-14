import { defineLink } from "@medusajs/framework/utils"
import MarketplaceModule from "../modules/marketplace"
import ApiKeyModule from "@medusajs/medusa/api-key"

/**
 * Links a Vendor to ApiKeys (Publishable & Secret).
 */
export default defineLink(
  {
    linkable: MarketplaceModule.linkable.vendor,
    deleteCascade: true,
  },
  {
    linkable: ApiKeyModule.linkable.apiKey.id,
    isList: true,
  }
)
