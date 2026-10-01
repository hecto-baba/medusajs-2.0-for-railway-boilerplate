import { defineRouteConfig } from "@medusajs/admin-sdk"
import DeliveriesPage from "../../deliveries/page"

export const config = defineRouteConfig({
  label: "Orders & Deliveries",
  rank: 2,
})

export default DeliveriesPage