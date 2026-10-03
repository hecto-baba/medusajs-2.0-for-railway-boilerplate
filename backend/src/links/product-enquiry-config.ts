import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import ProductEnquiryModule from "../modules/product-enquiry"

/**
 * 1:1, not isList - mirrors product-rental-config.ts exactly. A product has
 * at most one EnquiryConfiguration row.
 */
export default defineLink(
  ProductModule.linkable.product,
  ProductEnquiryModule.linkable.enquiryConfiguration
)
