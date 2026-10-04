import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CoreRedirectPage } from "../../../lib/core-redirect"

const CommerceCategoriesPage = () => (
  <CoreRedirectPage title="Categories" to="/categories" />
)

export const config = defineRouteConfig({
  label: "Categories",
  rank: 4,
})

export default CommerceCategoriesPage
