import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ReceiptPercent, Buildings, Calendar } from "@medusajs/icons"
import { Container, Heading, Text, Button } from "@medusajs/ui"
import { useNavigate } from "react-router-dom"

const EventsOverviewPage = () => {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-y-6 max-w-5xl">
      <div>
        <Heading level="h1" className="text-xl font-semibold">
          Events Management
        </Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Manage event venues, seating configurations, show schedules, and ticket product sales.
        </Text>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Venues Card */}
        <Container
          className="p-5 flex flex-col justify-between gap-y-4 hover:border-ui-border-strong transition-colors cursor-pointer"
          onClick={() => navigate("/events/venues")}
        >
          <div className="flex items-start gap-x-3">
            <div className="p-2 rounded-lg bg-ui-bg-subtle text-ui-fg-base border border-ui-border-base">
              <Buildings className="w-5 h-5" />
            </div>
            <div>
              <Heading level="h3" className="text-base font-semibold">
                Venues
              </Heading>
              <Text size="small" className="text-ui-fg-subtle mt-1">
                Configure stadiums, theaters, auditoriums, and tiered seating layouts.
              </Text>
            </div>
          </div>
          <Button
            size="small"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation()
              navigate("/events/venues")
            }}
          >
            Manage Venues &rarr;
          </Button>
        </Container>

        {/* Shows Card */}
        <Container
          className="p-5 flex flex-col justify-between gap-y-4 hover:border-ui-border-strong transition-colors cursor-pointer"
          onClick={() => navigate("/events/shows")}
        >
          <div className="flex items-start gap-x-3">
            <div className="p-2 rounded-lg bg-ui-bg-subtle text-ui-fg-base border border-ui-border-base">
              <ReceiptPercent className="w-5 h-5" />
            </div>
            <div>
              <Heading level="h3" className="text-base font-semibold">
                Shows
              </Heading>
              <Text size="small" className="text-ui-fg-subtle mt-1">
                Manage upcoming shows, event dates, runs, and ticket products.
              </Text>
            </div>
          </div>
          <Button
            size="small"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation()
              navigate("/events/shows")
            }}
          >
            Manage Shows &rarr;
          </Button>
        </Container>
        {/* Appointment Providers Card */}
        <Container
          className="p-5 flex flex-col justify-between gap-y-4 hover:border-ui-border-strong transition-colors cursor-pointer"
          onClick={() => navigate("/events/appointment-providers")}
        >
          <div className="flex items-start gap-x-3">
            <div className="p-2 rounded-lg bg-ui-bg-subtle text-ui-fg-base border border-ui-border-base">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <Heading level="h3" className="text-base font-semibold">
                Appointment Providers
              </Heading>
              <Text size="small" className="text-ui-fg-subtle mt-1">
                Manage appointment providers, their availability and bookings.
              </Text>
            </div>
          </div>
          <Button
            size="small"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation()
              navigate("/events/appointment-providers")
            }}
          >
            Manage Providers &rarr;
          </Button>
        </Container>
      </div>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Events",
  icon: ReceiptPercent,
  rank: 4,
})

export default EventsOverviewPage
