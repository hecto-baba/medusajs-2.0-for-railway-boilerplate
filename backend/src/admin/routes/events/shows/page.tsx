import { defineRouteConfig } from "@medusajs/admin-sdk"
import TicketProductsPage from "../../ticket-products/page"

export const config = defineRouteConfig({
  label: "Shows",
  rank: 1,
})

export default TicketProductsPage
