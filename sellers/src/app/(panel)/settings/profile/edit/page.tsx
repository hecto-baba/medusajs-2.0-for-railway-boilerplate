import { requireVendorSession } from "@lib/data/vendor"
import { EditProfileForm } from "@modules/settings/components/edit-profile-form"
import { ProfileGeneralSection } from "@modules/settings/components/profile-general-section"
import { ProfileMfaSection } from "@modules/settings/components/profile-mfa-section"
import { RouteDrawer } from "@modules/common/components/route-drawer/route-drawer"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Edit profile" }

/**
 * The edit drawer is its own route, as it is in the dashboard, so the section
 * behind it stays rendered and Back closes the drawer rather than leaving the
 * page.
 */
export default async function EditProfilePage() {
  const admin = await requireVendorSession()

  return (
    <div className="flex flex-col gap-y-3 p-6">
      <ProfileGeneralSection admin={admin} />
      <ProfileMfaSection />
      <RouteDrawer returnTo="/settings/profile">
        <EditProfileForm admin={admin} />
      </RouteDrawer>
    </div>
  )
}
