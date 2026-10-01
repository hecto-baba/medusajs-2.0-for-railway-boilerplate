import { defineRouteConfig } from "@medusajs/admin-sdk"
import SegmentsPage from "../../segments/page"

export const config = defineRouteConfig({
  label: "Segments",
  rank: 1,
})

export default SegmentsPage
