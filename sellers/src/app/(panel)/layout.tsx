import { requireVendorSession } from "@lib/data/vendor"
import { QueryProvider } from "@modules/components/query-provider"
import { Sidebar } from "@modules/components/sidebar"

/**
 * Shell for every signed-in page.
 *
 * The session is resolved once here rather than in each page: requireVendorSession
 * redirects to /login when there is none, so a page inside this group can assume
 * a vendor is present.
 */
export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const admin = await requireVendorSession()

  return (
    <QueryProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <Sidebar
          storeName={admin.vendor?.name ?? "Your store"}
          email={admin.email}
        />
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </QueryProvider>
  )
}
