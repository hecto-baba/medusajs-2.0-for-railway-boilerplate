import { DraftOrdersTable } from "@modules/draft-orders/components/draft-orders-table"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Draft Orders | Seller Dashboard",
  description: "Manage draft orders and manual order creation",
}

export default function DraftOrdersPage() {
  return (
    <div className="p-6">
      <DraftOrdersTable />
    </div>
  )
}
