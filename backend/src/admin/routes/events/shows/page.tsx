import { defineRouteConfig } from "@medusajs/admin-sdk"
import TicketProductsPage from "../../ticket-products/page"

export const config = defineRouteConfig({
  label: "Shows",
})

export default TicketProductsPage
