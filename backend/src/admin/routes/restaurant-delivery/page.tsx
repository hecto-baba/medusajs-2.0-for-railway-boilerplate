import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChefHat, FlyingBox, BuildingStorefront, CheckCircle } from "@medusajs/icons"
import { Container, Heading, Text, Button } from "@medusajs/ui"
import { useNavigate } from "react-router-dom"

const RestaurantDeliveryOverviewPage = () => {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-y-6 max-w-5xl">
      <div>
        <Heading level="h1" className="text-xl font-semibold">
          Restaurant-Delivery Management
        </Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Manage partner restaurants, custom multi-variant menus & dietary tags, and fulfill live kitchen delivery orders.
        </Text>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Restaurants Card */}
        <Container
          className="p-5 flex flex-col justify-between gap-y-4 hover:border-ui-border-strong transition-colors cursor-pointer"
          onClick={() => navigate("/restaurant-delivery/restaurants")}
        >
          <div className="flex items-start gap-x-3">
            <div className="p-2 rounded-lg bg-ui-bg-subtle text-ui-fg-base border border-ui-border-base">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <Heading level="h3" className="text-base font-semibold">
                🏬 Restaurants
              </Heading>
              <Text size="small" className="text-ui-fg-subtle mt-1">
                Manage restaurant profiles, operating hours, staff/admins, and food/beverage menus with multi-portion variants & dietary badges.
              </Text>
            </div>
          </div>
          <Button
            size="small"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation()
              navigate("/restaurant-delivery/restaurants")
            }}
          >
            Manage Restaurants &rarr;
          </Button>
        </Container>

        {/* Deliveries Card */}
        <Container
          className="p-5 flex flex-col justify-between gap-y-4 hover:border-ui-border-strong transition-colors cursor-pointer"
          onClick={() => navigate("/restaurant-delivery/deliveries")}
        >
          <div className="flex items-start gap-x-3">
            <div className="p-2 rounded-lg bg-ui-bg-subtle text-ui-fg-base border border-ui-border-base">
              <FlyingBox className="w-5 h-5" />
            </div>
            <div>
              <Heading level="h3" className="text-base font-semibold">
                🛵 Restaurant Orders / Deliveries
              </Heading>
              <Text size="small" className="text-ui-fg-subtle mt-1">
                Live kitchen order stream, driver dispatch, and 6-step fulfillment (Accept ➔ Prepare ➔ Ready ➔ In Transit ➔ Delivered).
              </Text>
            </div>
          </div>
          <Button
            size="small"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation()
              navigate("/restaurant-delivery/deliveries")
            }}
          >
            View Live Deliveries &rarr;
          </Button>
        </Container>
      </div>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Restaurant-Delivery",
  icon: ChefHat,
})

export default RestaurantDeliveryOverviewPage