import { DraftOrdersTable } from "@modules/draft-orders"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Draft Orders | Seller Dashboard",
  description: "Manage draft orders and manual order creation",
}

export default function DraftOrdersPage() {
  return <DraftOrdersTable />
}
