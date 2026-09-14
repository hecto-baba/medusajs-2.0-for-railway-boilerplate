import { VenuesTable } from "@modules/venues"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Venues" }

export default function VenuesPage() {
  return (
    <div className="p-6">
      <div className="bg-ui-bg-base shadow-elevation-card-rest overflow-hidden rounded-lg p-6">
        <VenuesTable />
      </div>
    </div>
  )
}
