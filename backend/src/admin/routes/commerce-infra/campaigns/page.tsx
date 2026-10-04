import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CoreRedirectPage } from "../../../lib/core-redirect"

const CommerceCampaignsPage = () => (
  <CoreRedirectPage title="Campaigns" to="/campaigns" />
)

export const config = defineRouteConfig({
  label: "Campaigns",
  rank: 11,
})

export default CommerceCampaignsPage
