import { defineLink } from "@medusajs/framework/utils"
import EoiModule from "../modules/expression-of-interest"
import ProductModule from "@medusajs/medusa/product"

// 1:1 writable link, mirrors ticket-product-variant.ts's shape (variant-scoped
// config, deleteCascade so a config row never outlives the variant it belongs to -
// an improvement over the old product-eoi-config.ts link, which had none).
//
// alias: "config_variant" is required here, not cosmetic. This module also has
// eoi-variant.ts (Eoi -> ProductVariant, readOnly), which defaults to the alias
// "product_variant" - ProductModule's own default alias for productVariant. Both
// links extend the same expressionOfInterest module service, so without an
// explicit alias here they'd collide on that same default name (one registering
// it as a relationship, the other as a fieldAlias) and db:generate fails with
// "Conflict configuration for service ... already defined as relationships".
export default defineLink(
  EoiModule.linkable.eoiConfiguration,
  {
    linkable: ProductModule.linkable.productVariant,
    alias: "config_variant",
    deleteCascade: true,
  }
)
