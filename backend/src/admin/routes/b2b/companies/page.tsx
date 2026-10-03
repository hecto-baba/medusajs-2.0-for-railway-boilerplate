import { defineRouteConfig } from "@medusajs/admin-sdk"
import CompaniesPage from "../../companies/page"

export const config = defineRouteConfig({
  label: "Companies",
  rank: 1,
})

export default CompaniesPage
