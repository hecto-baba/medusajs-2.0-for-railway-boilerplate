import { defineRouteConfig } from "@medusajs/admin-sdk"
import VendorTransactionTypesPage from "../../transaction-types/page"

export const config = defineRouteConfig({
  label: "Vendor Transactions",
  rank: 3,
})

export default VendorTransactionTypesPage
