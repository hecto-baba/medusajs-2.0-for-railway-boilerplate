import { defineRouteConfig } from "@medusajs/admin-sdk"
import DigitalProductsPage from "../../digital-products/page"

export const config = defineRouteConfig({
  label: "Digital Products",
  rank: 7,
})

export default DigitalProductsPage
