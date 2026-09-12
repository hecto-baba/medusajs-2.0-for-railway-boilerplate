import { OrdersTable } from "@modules/components/orders-table"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Orders" }

export default function OrdersPage() {
  return (
    <div className="p-6">
      <div className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg overflow-hidden">
        <OrdersTable />
      </div>
    </div>
  )
}
