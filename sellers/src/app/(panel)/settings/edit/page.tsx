import { requireVendorSession } from "@lib/data/vendor"
import { Text } from "@medusajs/ui"
import { RouteDrawer } from "@modules/common"
import { EditStoreForm, StoreGeneralSection } from "@modules/settings"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Edit store" }

export default async function EditStorePage() {
  const admin = await requireVendorSession()

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
      <RouteDrawer returnTo="/settings">
        <EditStoreForm vendor={admin.vendor} />
      </RouteDrawer>
    </div>
  )
}
