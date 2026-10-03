import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CoreRedirectPage } from "../../../lib/core-redirect"

const CommerceCollectionsPage = () => (
  <CoreRedirectPage title="Collections" to="/collections" />
)

export const config = defineRouteConfig({
  label: "Collections",
  rank: 3,
})

export default CommerceCollectionsPage
