import { PricingRules } from "@modules/appointments/components/pricing-rules"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Pricing Rules" }

export default function PricingRulesPage() {
  return (
    <div className="p-6">
      <PricingRules />
    </div>
  )
}
