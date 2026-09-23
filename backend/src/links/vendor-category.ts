import { defineLink } from "@medusajs/framework/utils"
import MarketplaceModule from "../modules/marketplace"
import ProductModule from "@medusajs/medusa/product"

/**
 * Links a Vendor to Product Categories.
 * isList on the product category side: a vendor can own and organize multiple categories.
 */
export default defineLink(
  {
    linkable: MarketplaceModule.linkable.vendor,
    deleteCascade: true,
  },
  {
    linkable: ProductModule.linkable.productCategory.id,
    isList: true,
  }
)
