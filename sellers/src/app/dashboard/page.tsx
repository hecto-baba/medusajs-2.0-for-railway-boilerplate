import { requireVendorSession } from "@lib/data/vendor"
import { VendorLogoutButton } from "@modules/components/vendor-logout-button"
import { Badge, Container, Heading, Text } from "@medusajs/ui"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your store at a glance.",
}

// The session is read from a cookie on every request, so there is nothing here
// that could be prerendered at build time.
export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const admin = await requireVendorSession()
  const vendor = admin.vendor

  const displayName =
    [admin.first_name, admin.last_name].filter(Boolean).join(" ") || admin.email

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 flex flex-col gap-y-6">
      <div className="flex items-start justify-between gap-x-4">
        <div className="flex flex-col gap-y-1">
          <Heading level="h1" className="text-ui-fg-base">
            {vendor?.name ?? "Your store"}
          </Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Signed in as {displayName}
          </Text>
        </div>
        <VendorLogoutButton />
      </div>

      <Container className="flex flex-col gap-y-4">
        <div className="flex items-center gap-x-2">
          <Badge color="green" size="xsmall">
            Active
          </Badge>
          <Text size="small" className="text-ui-fg-subtle">
            Your vendor session is working.
          </Text>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-y-1">
            <Text size="xsmall" className="text-ui-fg-muted uppercase">
              Store handle
            </Text>
            <Text size="small" className="text-ui-fg-base">
              {vendor?.handle ?? "—"}
            </Text>
          </div>
          <div className="flex flex-col gap-y-1">
            <Text size="xsmall" className="text-ui-fg-muted uppercase">
              Email
            </Text>
            <Text size="small" className="text-ui-fg-base">
              {admin.email}
            </Text>
          </div>
        </div>
      </Container>

      <Container className="flex flex-col gap-y-2">
        <Heading level="h2" className="text-ui-fg-base">
          Next steps
        </Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Products and orders are already available on the API at
          /vendors/products and /vendors/orders. Wiring them into this panel is
          the next piece of work.
        </Text>
      </Container>
    </div>
  )
}
