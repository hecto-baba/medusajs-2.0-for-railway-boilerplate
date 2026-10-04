import { TaxRatesCard } from "@modules/settings/components/tax-rates/tax-rates-card"
import { Metadata } from "next"

export const metadata: Metadata = { title: "My Tax Rates" }

export default function TaxRatesPage() {
  return (
    <div className="flex flex-col gap-y-3 p-6">
      <TaxRatesCard />
    </div>
  )
}
