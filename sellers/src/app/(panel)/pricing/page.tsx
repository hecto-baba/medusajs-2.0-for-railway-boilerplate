import { PriceListsTable } from "@modules/pricing/components/price-lists-table"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Price Lists" }

export default function PricingPage() {
  return (
    <div className="p-6">
      <PriceListsTable />
    </div>
  )
}
