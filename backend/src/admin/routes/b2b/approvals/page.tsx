import { defineRouteConfig } from "@medusajs/admin-sdk"
import ApprovalsPage from "../../approvals/page"

export const config = defineRouteConfig({
  label: "Approvals",
  rank: 3,
})

export default ApprovalsPage
