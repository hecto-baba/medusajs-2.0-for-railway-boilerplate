import { requireVendorSession } from "@lib/data/vendor"
import {
  EditProfileForm,
  ProfileGeneralSection,
  ProfileMfaSection,
} from "@modules/settings"
import { RouteDrawer } from "@modules/common"
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
