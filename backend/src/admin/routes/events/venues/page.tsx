import { defineRouteConfig } from "@medusajs/admin-sdk"
import VenuesPage from "../../venues/page"

export const config = defineRouteConfig({
  label: "Venues",
})

export default VenuesPage
