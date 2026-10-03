import { defineRouteConfig } from "@medusajs/admin-sdk"
import { SquaresPlus } from "@medusajs/icons"
import { Container, Heading, Text, Button } from "@medusajs/ui"
import { useNavigate } from "react-router-dom"

const MarketplaceOverviewPage = () => {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-y-6 max-w-5xl">
      <div>
        <Heading level="h1" className="text-xl font-semibold">
          Marketplace
        </Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Organise the marketplace catalogue into segments.
        </Text>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Container
          className="p-5 flex flex-col justify-between gap-y-4 hover:border-ui-border-strong transition-colors cursor-pointer"
          onClick={() => navigate("/marketplace/segments")}
        >
          <div className="flex items-start gap-x-3">
            <div className="p-2 rounded-lg bg-ui-bg-subtle text-ui-fg-base border border-ui-border-base">
              <SquaresPlus className="w-5 h-5" />
            </div>
            <div>
              <Heading level="h3" className="text-base font-semibold">
                Segments
              </Heading>
              <Text size="small" className="text-ui-fg-subtle mt-1">
                Create and manage marketplace segments and their hierarchy.
              </Text>
            </div>
          </div>
          <Button
            size="small"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation()
              navigate("/marketplace/segments")
            }}
          >
            Manage Segments &rarr;
          </Button>
        </Container>
      </div>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Marketplace",
  icon: SquaresPlus,
  rank: 3,
})

export default MarketplaceOverviewPage
