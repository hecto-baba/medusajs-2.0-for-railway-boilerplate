import { defineLink } from "@medusajs/framework/utils"
import CustomerModule from "@medusajs/medusa/customer"
import ProductEnquiryModule from "../modules/product-enquiry"

/**
 * Optional: only populated when the enquiry was submitted by an
 * authenticated customer. Guest enquiries (customer_id null on the Enquiry
 * row) have no link row here. Enables a future "My Enquiries" storefront
 * page without a schema change.
 *
 * isList on the ENQUIRY side: one customer has many enquiries (see
 * product-enquiry.ts for why the side matters).
 */
export default defineLink(CustomerModule.linkable.customer, {
  linkable: ProductEnquiryModule.linkable.enquiry,
  isList: true,
})
