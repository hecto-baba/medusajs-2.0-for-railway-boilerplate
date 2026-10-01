import { ShippingProfilesCard } from "@modules/settings"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Shipping Profiles" }

export default function ShippingProfilesPage() {
  return (
    <div className="flex flex-col gap-y-3 p-6">
      <ShippingProfilesCard />
    </div>
  )
}
