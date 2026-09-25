import { ShippingOptionTypesCard } from "@modules/settings/components/locations/shipping-option-types-card"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Shipping Option Types" }

export default function ShippingOptionTypesPage() {
  return (
    <div className="flex flex-col gap-y-3 p-6">
      <ShippingOptionTypesCard />
    </div>
  )
}
