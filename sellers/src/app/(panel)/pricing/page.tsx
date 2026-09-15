import { PriceListsTable } from "@modules/pricing"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Price Lists" }

export default function PricingPage() {
  return (
    <div className="p-6">
      <PriceListsTable />
    </div>
  )
}
