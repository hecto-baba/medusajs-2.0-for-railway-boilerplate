import { requireVendorSession } from "@lib/data/vendor"
import { Text } from "@medusajs/ui"
import { StoreGeneralSection } from "@modules/settings"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Store" }

export default async function StoreSettingsPage() {
  const admin = await requireVendorSession()

  // The vendor is created alongside the admin in the signup workflow, so a
  // missing one means the record was removed while the session stayed live.
  if (!admin.vendor) {
    return (
      <div className="p-6">
        <Text size="small" className="text-ui-fg-subtle">
          No store is linked to this account. Please contact support.
        </Text>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-y-3 p-6">
      <StoreGeneralSection vendor={admin.vendor} />
    </div>
  )
}
