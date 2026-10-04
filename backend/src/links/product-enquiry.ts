import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import ProductEnquiryModule from "../modules/product-enquiry"

/**
 * isList goes on the ENQUIRY side: one product has many enquiries. (isList
 * marks the "many" side - see vendor-product.ts, where the product side is the
 * list because a vendor sells many products. Putting it on the product side
 * instead means "one enquiry per product": the second enquiry on any product
 * fails with "Cannot create multiple links between 'product' and
 * 'productEnquiry'".)
 *
 * No deleteCascade: enquiry rows are kept for record-keeping if a product is
 * later deleted, rather than being silently dropped (see docs/plan/
 * PRODUCT_ENQUIRY_MODULE_PLAN_ADMIN.md, Phase 7 testing checklist).
 */
export default defineLink(ProductModule.linkable.product, {
  linkable: ProductEnquiryModule.linkable.enquiry,
  isList: true,
})
