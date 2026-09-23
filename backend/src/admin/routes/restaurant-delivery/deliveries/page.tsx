import { defineRouteConfig } from "@medusajs/admin-sdk"
import DeliveriesPage from "../../deliveries/page"

export const config = defineRouteConfig({
  label: "Restaurant Orders / Delivery",
})

export default DeliveriesPage