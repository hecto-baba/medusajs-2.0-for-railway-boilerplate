import { defineLink } from "@medusajs/framework/utils"
import EoiModule from "../modules/expression-of-interest"
import ProductModule from "@medusajs/medusa/product"

// 1:1 writable link, mirrors product-rental-config.ts.
export default defineLink(
  ProductModule.linkable.product,
  EoiModule.linkable.eoiConfiguration
)
