import { ShippingOptionsCard } from "@modules/settings"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Shipping Options" }

export default function ShippingOptionsPage() {
  return (
    <div className="flex flex-col gap-y-3 p-6">
      <ShippingOptionsCard />
    </div>
  )
}
