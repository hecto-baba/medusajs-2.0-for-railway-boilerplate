import { defineRouteConfig } from "@medusajs/admin-sdk"
import { BuildingStorefront, DocumentText, CheckCircle } from "@medusajs/icons"
import { Container, Heading, Text, Button } from "@medusajs/ui"
import { useNavigate } from "react-router-dom"

const B2BOverviewPage = () => {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-y-6 max-w-5xl">
      <div>
        <Heading level="h1" className="text-xl font-semibold">
          B2B Management
        </Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Manage B2B company accounts, quote negotiations with shipping/delivery pricing, and purchase order spending approvals.
        </Text>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Quotes Card */}
        <Container
          className="p-5 flex flex-col justify-between gap-y-4 hover:border-ui-border-strong transition-colors cursor-pointer"
          onClick={() => navigate("/b2b/quotes")}
        >
          <div className="flex items-start gap-x-3">
            <div className="p-2 rounded-lg bg-ui-bg-subtle text-ui-fg-base border border-ui-border-base">
              <DocumentText className="w-5 h-5" />
            </div>
            <div>
              <Heading level="h3" className="text-base font-semibold">
                Quotes
              </Heading>
              <Text size="small" className="text-ui-fg-subtle mt-1">
                Wholesale quote negotiations, price overrides, and custom delivery fees.
              </Text>
            </div>
          </div>
          <Button
            size="small"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation()
              navigate("/b2b/quotes")
            }}
          >
            Manage Quotes &rarr;
          </Button>
        </Container>

        {/* Companies Card */}
        <Container
          className="p-5 flex flex-col justify-between gap-y-4 hover:border-ui-border-strong transition-colors cursor-pointer"
          onClick={() => navigate("/b2b/companies")}
        >
          <div className="flex items-start gap-x-3">
            <div className="p-2 rounded-lg bg-ui-bg-subtle text-ui-fg-base border border-ui-border-base">
              <BuildingStorefront className="w-5 h-5" />
            </div>
            <div>
              <Heading level="h3" className="text-base font-semibold">
                Companies
              </Heading>
              <Text size="small" className="text-ui-fg-subtle mt-1">
                Corporate profiles, assigned customer pricing groups, and spending limits.
              </Text>
            </div>
          </div>
          <Button
            size="small"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation()
              navigate("/b2b/companies")
            }}
          >
            Manage Companies &rarr;
          </Button>
        </Container>

        {/* Approvals Card */}
        <Container
          className="p-5 flex flex-col justify-between gap-y-4 hover:border-ui-border-strong transition-colors cursor-pointer"
          onClick={() => navigate("/b2b/approvals")}
        >
          <div className="flex items-start gap-x-3">
            <div className="p-2 rounded-lg bg-ui-bg-subtle text-ui-fg-base border border-ui-border-base">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <Heading level="h3" className="text-base font-semibold">
                Approvals
              </Heading>
              <Text size="small" className="text-ui-fg-subtle mt-1">
                Review and approve corporate orders that exceed spending limits.
              </Text>
            </div>
          </div>
          <Button
            size="small"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation()
              navigate("/b2b/approvals")
            }}
          >
            Review Approvals &rarr;
          </Button>
        </Container>
      </div>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "B2B",
  icon: BuildingStorefront,
})

export default B2BOverviewPage
