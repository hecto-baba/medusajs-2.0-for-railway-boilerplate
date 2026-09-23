import { defineLink } from "@medusajs/framework/utils"
import MarketplaceModule from "../modules/marketplace"
import ProductModule from "@medusajs/medusa/product"

/**
 * Links a Vendor to Product Collections.
 * isList on the product collection side: a vendor can own and manage multiple collections.
 */
export default defineLink(
  {
    linkable: MarketplaceModule.linkable.vendor,
    deleteCascade: true,
  },
  {
    linkable: ProductModule.linkable.productCollection.id,
    isList: true,
  }
)
