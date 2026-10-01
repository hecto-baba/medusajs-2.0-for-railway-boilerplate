import { defineRouteConfig } from "@medusajs/admin-sdk"
import QuotesPage from "../../quotes/page"

export const config = defineRouteConfig({
  label: "Quotes",
})

export default QuotesPage
