import { defineLink } from "@medusajs/framework/utils"
import EoiModule from "../modules/expression-of-interest"
import ProductModule from "@medusajs/medusa/product"

// One-to-many writable link, mirrors product-enquiry.ts.
export default defineLink(
  { linkable: ProductModule.linkable.product, isList: true },
  EoiModule.linkable.eoi
)
