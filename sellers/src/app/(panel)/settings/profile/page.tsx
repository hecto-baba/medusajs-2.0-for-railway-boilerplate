import { requireVendorSession } from "@lib/data/vendor"
import { ProfileGeneralSection } from "@modules/settings/components/profile-general-section"
import { ProfileMfaSection } from "@modules/settings/components/profile-mfa-section"
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
