import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CoreRedirectPage } from "../../../lib/core-redirect"

const CommerceProductOptionsPage = () => (
  <CoreRedirectPage title="Options" to="/product-options" />
)

export const config = defineRouteConfig({
  label: "Options",
  rank: 5,
})

export default CommerceProductOptionsPage
