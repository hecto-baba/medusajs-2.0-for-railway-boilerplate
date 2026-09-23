import { ReservationsTable } from "@modules/inventory"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Reservations",
  description: "Manage the reserved quantity of inventory items.",
}

export default function ReservationsPage() {
  return (
    <div className="p-6">
      <ReservationsTable />
    </div>
  )
}
