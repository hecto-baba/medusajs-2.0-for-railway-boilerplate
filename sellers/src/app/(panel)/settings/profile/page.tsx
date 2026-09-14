import { requireVendorSession } from "@lib/data/vendor"
import { ProfileGeneralSection, ProfileMfaSection } from "@modules/settings"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Profile" }

export default async function ProfileSettingsPage() {
  const admin = await requireVendorSession()

  return (
    <div className="flex flex-col gap-y-3 p-6">
      <ProfileGeneralSection admin={admin} />
      <ProfileMfaSection />
    </div>
  )
}
