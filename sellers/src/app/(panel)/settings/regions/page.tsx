import { RegionsTable } from "@modules/settings"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Regions & Currencies" }

export default function RegionsPage() {
  return (
    <div className="flex flex-col gap-y-3 p-6">
      <RegionsTable />
    </div>
  )
}
