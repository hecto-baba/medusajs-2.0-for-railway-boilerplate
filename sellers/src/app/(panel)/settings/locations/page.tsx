import { LocationsTable } from "@modules/settings"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Locations & Shipping" }

export default function LocationsPage() {
  return (
    <div className="flex flex-col gap-y-3 p-6">
      <LocationsTable />
    </div>
  )
}
