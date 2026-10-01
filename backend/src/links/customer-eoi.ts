import { defineLink } from "@medusajs/framework/utils"
import EoiModule from "../modules/expression-of-interest"
import CustomerModule from "@medusajs/medusa/customer"

// One-to-many, optional - guest EOIs have customer_id: null and no link row.
// Mirrors customer-enquiry.ts.
export default defineLink(
  { linkable: CustomerModule.linkable.customer, isList: true },
  EoiModule.linkable.eoi
)
