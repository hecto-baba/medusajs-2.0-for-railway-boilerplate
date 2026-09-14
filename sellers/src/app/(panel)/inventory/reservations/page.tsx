import { ReservationsTable } from "@modules/inventory"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Reservations | Inventory" }

export default function ReservationsPage() {
  return (
    <div className="p-6">
      <div className="bg-ui-bg-base shadow-elevation-card-rest overflow-hidden rounded-lg">
        <ReservationsTable />
      </div>
    </div>
  )
}
