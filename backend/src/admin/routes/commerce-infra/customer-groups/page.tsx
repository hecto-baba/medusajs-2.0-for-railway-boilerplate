import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CoreRedirectPage } from "../../../lib/core-redirect"

const CommerceCustomerGroupsPage = () => (
  <CoreRedirectPage title="Customer Groups" to="/customer-groups" />
)

export const config = defineRouteConfig({
  label: "Customer Groups",
  rank: 9,
})

export default CommerceCustomerGroupsPage
