import { defineLink } from "@medusajs/framework/utils"
import EoiModule from "../modules/expression-of-interest"
import ProductModule from "@medusajs/medusa/product"

// readOnly, keyed on the existing variant_id column. Mirrors rental-variant.ts.
export default defineLink(
  { linkable: EoiModule.linkable.eoi, field: "variant_id" },
  ProductModule.linkable.productVariant,
  { readOnly: true }
)
