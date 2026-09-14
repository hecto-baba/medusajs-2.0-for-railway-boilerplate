import { SettingsNav } from "@modules/settings"

/**
 * Two-column shell for settings: the section nav beside the active page.
 *
 * The session guard lives in the parent (panel) layout, so pages here can
 * assume a signed-in vendor without checking again.
 */
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-full">
      <SettingsNav />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
