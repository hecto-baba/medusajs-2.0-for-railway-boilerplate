import { PriceListsTable } from "@modules/pricing"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Price Lists" }

export default function PricingPage() {
  return (
    <div className="p-6">
      <div className="bg-ui-bg-base shadow-elevation-card-rest overflow-hidden rounded-lg p-6">
        <PriceListsTable />
      </div>
    </div>
  )
}
