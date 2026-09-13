import { requireVendorSession } from "@lib/data/vendor"
import { QueryProvider } from "@modules/common"
import { PanelShell } from "@modules/layout"

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
      <PanelShell
        storeName={admin.vendor?.name ?? "Your store"}
        email={admin.email}
        name={
          [admin.first_name, admin.last_name].filter(Boolean).join(" ") || null
        }
      >
        {children}
      </PanelShell>
    </QueryProvider>
  )
}
