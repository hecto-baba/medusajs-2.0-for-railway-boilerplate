import { defineLink } from "@medusajs/framework/utils"
import MarketplaceModule from "../modules/marketplace"
import ProductModule from "@medusajs/medusa/product"

/**
 * isList on the product side: a vendor sells many products. The link is
 * written by the vendor-product workflow via createRemoteLinkStep, and read
 * when scoping a vendor admin's catalogue through vendor.products.*.
 *
 * deleteCascade drops the link rows with the vendor rather than stranding
 * them; the products themselves are owned by the Product module and survive.
 */
export default defineLink(
  {
    linkable: MarketplaceModule.linkable.vendor,
    deleteCascade: true,
  },
  {
    linkable: ProductModule.linkable.product.id,
    isList: true,
  }
)
