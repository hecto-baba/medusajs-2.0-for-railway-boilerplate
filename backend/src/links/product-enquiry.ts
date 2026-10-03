import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import ProductEnquiryModule from "../modules/product-enquiry"

/**
 * isList on the product side: a product accumulates many enquiries. Mirrors
 * product-rental-config.ts's shape but as a list link (rental-config is 1:1
 * per product; enquiries are many).
 *
 * No deleteCascade: enquiry rows are kept for record-keeping if a product is
 * later deleted, rather than being silently dropped (see docs/plan/
 * PRODUCT_ENQUIRY_MODULE_PLAN_ADMIN.md, Phase 7 testing checklist).
 */
export default defineLink(
  { linkable: ProductModule.linkable.product, isList: true },
  ProductEnquiryModule.linkable.enquiry
)
