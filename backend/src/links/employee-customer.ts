import { defineLink } from "@medusajs/framework/utils"
import CompanyModule from "../modules/company"
import CustomerModule from "@medusajs/medusa/customer"

export default defineLink(
  CompanyModule.linkable.employee,
  CustomerModule.linkable.customer
)
