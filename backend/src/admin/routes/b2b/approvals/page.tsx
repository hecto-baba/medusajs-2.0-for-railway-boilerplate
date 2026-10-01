import { defineRouteConfig } from "@medusajs/admin-sdk"
import ApprovalsPage from "../../approvals/page"

export const config = defineRouteConfig({
  label: "Approvals",
})

export default ApprovalsPage
