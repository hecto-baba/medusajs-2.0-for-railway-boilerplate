import { defineRouteConfig } from "@medusajs/admin-sdk"
import VendorTypesPage from "../../vendor-types/page"

export const config = defineRouteConfig({
  label: "Vendor Types",
  rank: 1,
})

export default VendorTypesPage
