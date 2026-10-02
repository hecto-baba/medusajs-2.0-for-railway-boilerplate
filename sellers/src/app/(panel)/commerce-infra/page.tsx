import { requireVendorSession } from "@lib/data/vendor"
import { CommerceInfraOverview } from "@modules/dashboard"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Commerce Infrastructure",
  description: "Unified management hub for core commerce operations.",
}

export const dynamic = "force-dynamic"

export default async function CommerceInfraPage() {
  const admin = await requireVendorSession()
  const vendor = admin.vendor

  const displayName =
    [admin.first_name, admin.last_name].filter(Boolean).join(" ") || admin.email

  return (
    <div className="w-full px-6 py-6 flex flex-col gap-y-6">
      <CommerceInfraOverview
        storeName={vendor?.name ?? "Your store"}
        displayName={displayName}
      />
    </div>
  )
}
