import { defineLink } from "@medusajs/framework/utils"
import MarketplaceModule from "../modules/marketplace"
import ProductModule from "@medusajs/medusa/product"

/**
 * Links a Vendor to Product Options.
 * isList on the product option side: a vendor can own and configure multiple product options.
 */
export default defineLink(
  {
    linkable: MarketplaceModule.linkable.vendor,
    deleteCascade: true,
  },
  {
    linkable: ProductModule.linkable.productOption.id,
    isList: true,
  }
)
