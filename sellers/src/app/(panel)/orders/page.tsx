import { OrdersTable } from "@modules/orders"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Orders" }

export default function OrdersPage() {
  return (
    <div className="p-6">
      <OrdersTable />
    </div>
  )
}
