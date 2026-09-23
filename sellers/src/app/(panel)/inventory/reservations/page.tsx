import { ReservationsTable } from "@modules/inventory"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Reservations | Inventory",
  description: "Manage the reserved quantity of inventory items.",
}

export default function InventoryReservationsPage() {
  return (
    <div className="p-6">
      <ReservationsTable />
    </div>
  )
}
