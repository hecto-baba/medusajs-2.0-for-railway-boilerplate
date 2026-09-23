import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  ServerStack,
  ShoppingCart,
  Tag,
  Buildings,
  Users,
  ReceiptPercent,
  CurrencyDollar,
  ArrowRight,
} from "@medusajs/icons"
import { Container, Heading, Text, Button, Badge } from "@medusajs/ui"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { sdk } from "../../lib/sdk"

const CommerceInfraOverviewPage = () => {
  const navigate = useNavigate()

  // Fetch counts for modules
  const { data: ordersData } = useQuery({
    queryKey: ["commerce-infra", "orders-count"],
    queryFn: () => sdk.client.fetch<any>("/admin/orders?limit=0").catch(() => null),
  })

  const { data: productsData } = useQuery({
    queryKey: ["commerce-infra", "products-count"],
    queryFn: () => sdk.client.fetch<any>("/admin/products?limit=0").catch(() => null),
  })

  const { data: inventoryData } = useQuery({
    queryKey: ["commerce-infra", "inventory-count"],
    queryFn: () => sdk.client.fetch<any>("/admin/inventory-items?limit=0").catch(() => null),
  })

  const { data: customersData } = useQuery({
    queryKey: ["commerce-infra", "customers-count"],
    queryFn: () => sdk.client.fetch<any>("/admin/customers?limit=0").catch(() => null),
  })

  const { data: promotionsData } = useQuery({
    queryKey: ["commerce-infra", "promotions-count"],
    queryFn: () => sdk.client.fetch<any>("/admin/promotions?limit=0").catch(() => null),
  })

  const { data: priceListsData } = useQuery({
    queryKey: ["commerce-infra", "price-lists-count"],
    queryFn: () => sdk.client.fetch<any>("/admin/price-lists?limit=0").catch(() => null),
  })

  const modules = [
    {
      id: "orders",
      title: "Orders",
      path: "/orders",
      icon: ShoppingCart,
      badgeText: ordersData?.count !== undefined ? `${ordersData.count} Orders` : "Active Orders",
      badgeColor: "blue" as const,
      description:
        "Manage customer orders, view live settlement status, coordinate logistics dispatches, and process physical deliveries.",
      cta: "Manage Orders",
    },
    {
      id: "products",
      title: "Products",
      path: "/products",
      icon: Tag,
      badgeText: productsData?.count !== undefined ? `${productsData.count} Products` : "Catalog",
      badgeColor: "purple" as const,
      description:
        "Organize catalog merchandise, define multi-portion and size variants, assign categories, and publish sales channels.",
      cta: "Manage Products",
    },
    {
      id: "inventory",
      title: "Inventory",
      path: "/inventory",
      icon: Buildings,
      badgeText: inventoryData?.count !== undefined ? `${inventoryData.count} Items` : "Stock Levels",
      badgeColor: "green" as const,
      description:
        "Track multi-location warehouse stock, monitor item availability thresholds, and manage stock reservations in real-time.",
      cta: "Manage Inventory",
    },
    {
      id: "customers",
      title: "Customers",
      path: "/customers",
      icon: Users,
      badgeText: customersData?.count !== undefined ? `${customersData.count} Customers` : "Accounts",
      badgeColor: "orange" as const,
      description:
        "Manage customer directory, view order transaction history, and organize customer groups for personalized wholesale pricing.",
      cta: "Manage Customers",
    },
    {
      id: "promotions",
      title: "Promotions",
      path: "/promotions",
      icon: ReceiptPercent,
      badgeText: promotionsData?.count !== undefined ? `${promotionsData.count} Promotions` : "Campaigns",
      badgeColor: "red" as const,
      description:
        "Configure promotional discount campaigns, promo coupon codes, minimum order value rules, and automated checkout promotions.",
      cta: "Manage Promotions",
    },
    {
      id: "price-lists",
      title: "Price Lists",
      path: "/price-lists",
      icon: CurrencyDollar,
      badgeText: priceListsData?.count !== undefined ? `${priceListsData.count} Price Lists` : "Tiers",
      badgeColor: "grey" as const,
      description:
        "Create custom price lists, define currency-specific overrides, and establish volume-based wholesale discount tiers.",
      cta: "Manage Price Lists",
    },
  ]

  return (
    <div className="flex flex-col gap-y-6 max-w-6xl pb-16">
      {/* Header Banner */}
      <div className="flex flex-col gap-y-1">
        <div className="flex items-center gap-x-2">
          <Heading level="h1" className="text-xl font-semibold">
            Commerce Infrastructure
          </Heading>
          <Badge color="blue" size="small">
            Core Modules
          </Badge>
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          Unified management hub for core commerce operations: orders, product catalog, inventory stock, customer relationships, promotions, and wholesale price lists.
        </Text>
      </div>

      {/* 6-Card Grid matching B2B styling */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((m) => {
          const Icon = m.icon
          return (
            <Container
              key={m.id}
              className="p-5 flex flex-col justify-between gap-y-4 hover:border-ui-border-strong transition-colors cursor-pointer"
              onClick={() => navigate(m.path)}
            >
              <div className="flex flex-col gap-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-ui-bg-subtle text-ui-fg-base border border-ui-border-base">
                    <Icon className="w-5 h-5" />
                  </div>
                  <Badge color={m.badgeColor} size="xsmall">
                    {m.badgeText}
                  </Badge>
                </div>
                <div>
                  <Heading level="h3" className="text-base font-semibold">
                    {m.title}
                  </Heading>
                  <Text size="small" className="text-ui-fg-subtle mt-1.5 leading-relaxed">
                    {m.description}
                  </Text>
                </div>
              </div>

              <div className="pt-2 border-t border-ui-border-base/50 flex items-center justify-between">
                <Button
                  size="small"
                  variant="secondary"
                  className="w-full justify-between text-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(m.path)
                  }}
                >
                  <span>{m.cta}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Container>
          )
        })}
      </div>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Commerce Infra",
  icon: ServerStack,
  rank: 1,
})

export default CommerceInfraOverviewPage
