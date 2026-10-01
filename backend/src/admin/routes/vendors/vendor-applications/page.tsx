import { defineRouteConfig } from "@medusajs/admin-sdk"
import VendorApplicationsPage from "../../vendor-applications/page"

export const config = defineRouteConfig({
  label: "Vendor Applications",
  rank: 2,
})

export default VendorApplicationsPage
