"use client"

import {
  Buildings,
  BuildingStorefront,
  Calendar,
  ChatBubbleLeftRight,
  ChefHat,
  CogSixTooth,
  CurrencyDollar,
  DocumentText,
  ReceiptPercent,
  ShoppingCart,
  Sparkles,
  ServerStack,
  Tag,
  Users,
} from "@medusajs/icons"
import { clx, Text } from "@medusajs/ui"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo } from "react"
import { UserMenu } from "./user-menu"
import { StoreHeaderDropdown } from "./store-header-dropdown"
import {
  LayoutComposer,
  CUSTOMIZE_IDS,
  CORE_LAYOUT_IDS,
} from "../layout-composer"
import { Searchbar } from "../search"
import { useVendorOnboardingStatus } from "@modules/onboarding"
import { getVendorCapabilities } from "@lib/permissions/feature-access"

type NavItem = {
  href: string
  label: string
  icon: any
  items?: { href: string; label: string }[]
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Commerce Infra",
    icon: ServerStack,
  },
  {
    href: "/orders",
    label: "Orders",
    icon: ShoppingCart,
    items: [
      { href: "/orders/drafts", label: "Drafts" },
      { href: "/orders/earnings", label: "Earnings" },
    ],
  },
  {
    href: "/products",
    label: "Products",
    icon: Tag,
    items: [
      { href: "/products/collections", label: "Collections" },
      { href: "/products/categories", label: "Categories" },
      { href: "/products/options", label: "Options" },
    ],
  },
  {
    href: "/inventory",
    label: "Inventory",
    icon: BuildingStorefront,
    items: [{ href: "/reservations", label: "Reservations" }],
  },
  {
    href: "/customers",
    label: "Customers",
    icon: Users,
    items: [{ href: "/customers/groups", label: "Customer Groups" }],
  },
  // Enquiries hang off products, so they follow the Products capability.
  { href: "/enquiries", label: "Enquiries", icon: ChatBubbleLeftRight },
  { href: "/pricing", label: "Price Lists", icon: CurrencyDollar },
  {
    href: "/promotions",
    label: "Promotions",
    icon: ReceiptPercent,
    items: [{ href: "/promotions/campaigns", label: "Campaigns" }],
  },
  { href: "/venues", label: "Venues", icon: Buildings },
  { href: "/shows", label: "Shows", icon: Calendar },
  {
    href: "/appointments",
    label: "Booking",
    icon: Calendar,
    items: [
      { href: "/appointments", label: "Overview" },
      { href: "/appointments/resources", label: "Resources" },
      { href: "/appointments/pricing-rules", label: "Pricing Rules" },
      { href: "/appointments/bookings", label: "Bookings" },
    ],
  },
  { href: "/my-schedule", label: "My Schedule", icon: Calendar },
  {
    href: "/b2b",
    label: "B2B",
    icon: BuildingStorefront,
    items: [
      { href: "/b2b/quotes", label: "Quotes" },
      { href: "/b2b/companies", label: "Companies" },
      { href: "/b2b/approvals", label: "Approvals" },
    ],
  },
  {
    href: "/restaurants",
    label: "Restaurants",
    icon: ChefHat,
    items: [
      { href: "/restaurants", label: "Overview & Menu" },
      { href: "/restaurants/deliveries", label: "Live Deliveries" },
    ],
  },
  {
    href: "/digital-products",
    label: "Digital Products",
    icon: DocumentText,
  },
]

const BASE_NAV_LINK_CLASSES =
  "text-ui-fg-subtle transition-fg hover:bg-ui-bg-subtle-hover flex items-center gap-x-2 rounded-md py-0.5 pl-0.5 pr-2 outline-none [&>svg]:text-ui-fg-subtle focus-visible:shadow-borders-focus"
const ACTIVE_NAV_LINK_CLASSES =
  "bg-ui-bg-base shadow-elevation-card-rest text-ui-fg-base hover:bg-ui-bg-base"
const NESTED_NAV_LINK_CLASSES =
  "pl-[34px] pr-2 py-1 w-full text-ui-fg-muted hover:text-ui-fg-base transition-fg text-small"
const NESTED_ACTIVE_CLASSES =
  "text-ui-fg-base font-semibold"

type SidebarProps = {
  storeName: string
  email: string
  name: string | null
}

export const Sidebar = ({ storeName, email, name }: SidebarProps) => {
  const pathname = usePathname()
  const { data: onboarding } = useVendorOnboardingStatus()

  const capabilities = useMemo(
    () => getVendorCapabilities(onboarding),
    [onboarding]
  )

  // Filter navigation items dynamically based on vendor segment & type capabilities
  const visibleNavItems = useMemo(() => {
    const isApproved = onboarding?.status === "APPROVED"

    // If not yet approved by admin, strictly show ONLY the Onboarding flow
    if (!isApproved) {
      return [
        {
          href: "/onboarding",
          label: "Onboarding",
          icon: Sparkles,
        },
      ]
    }

    const filtered = NAV_ITEMS.filter((item) => {
      if (item.href === "/orders" && !capabilities.hasOrders) return false
      if (item.href === "/products" && !capabilities.hasProducts) return false
      if (item.href === "/enquiries" && !capabilities.hasProducts) return false
      if (item.href === "/inventory" && !capabilities.hasInventory) return false
      if (item.href === "/pricing" && !capabilities.hasPricing) return false
      if (item.href === "/promotions" && !capabilities.hasPromotions) return false
      if (item.href === "/venues" && !capabilities.hasVenues) return false
      if (item.href === "/shows" && !capabilities.hasShows) return false
      if (item.href === "/b2b" && !capabilities.hasB2B) return false
      if (item.href === "/restaurants" && !capabilities.hasRestaurants) return false
      if (item.href === "/digital-products" && !capabilities.hasDigitalProducts) return false
      return true
    })

    return filtered
  }, [capabilities, onboarding])

  const verticalLabel = onboarding?.segment?.name || null
  const vendorTypeLabel = onboarding?.vendorType?.code || null

  return (
    <aside className="bg-ui-bg-subtle border-ui-border-base flex h-screen w-[220px] shrink-0 flex-col justify-between border-r">
      <div className="flex flex-col gap-y-3 p-3 overflow-y-auto flex-1">
        <StoreHeaderDropdown
          storeName={storeName}
          verticalLabel={verticalLabel}
          vendorTypeLabel={vendorTypeLabel}
        />

        <div className="border-ui-border-base border-t border-dashed" />

        <nav className="flex flex-col">
          <LayoutComposer
            widgetsZonePrefix="sidebar"
            preferredLayoutId={CORE_LAYOUT_IDS.SINGLE_COLUMN}
            customizeId={CUSTOMIZE_IDS.MAIN_SIDEBAR}
            controlSize="small"
            sections={{
              main: (
                <>
                  <LayoutComposer.Entry id="Searchbar">
                    <Searchbar />
                  </LayoutComposer.Entry>
                  {visibleNavItems.map((item) => {
                    const Icon = item.icon
                    const isExactParentActive =
                      item.href === "/dashboard"
                        ? pathname === "/dashboard" || pathname === "/commerce-infra"
                        : item.href === "/orders"
                        ? pathname === "/orders" ||
                          (pathname.startsWith("/orders/") &&
                            !pathname.startsWith("/orders/drafts") &&
                            !pathname.startsWith("/orders/earnings"))
                        : item.href === "/products"
                        ? pathname === "/products" ||
                          (pathname.startsWith("/products/") &&
                            !pathname.startsWith("/products/collections") &&
                            !pathname.startsWith("/products/categories") &&
                            !pathname.startsWith("/products/options"))
                        : item.href === "/inventory"
                        ? pathname === "/inventory" ||
                          (pathname.startsWith("/inventory/") &&
                            !pathname.startsWith("/inventory/reservations"))
                        : item.href === "/customers"
                        ? pathname === "/customers" ||
                          (pathname.startsWith("/customers/") &&
                            !pathname.startsWith("/customers/groups"))
                        : item.href === "/promotions"
                        ? pathname === "/promotions" ||
                          (pathname.startsWith("/promotions/") &&
                            !pathname.startsWith("/promotions/campaigns"))
                        : pathname === item.href

                    const isSectionActive =
                      item.href === "/dashboard"
                        ? pathname === "/dashboard" || pathname === "/commerce-infra"
                        : pathname === item.href ||
                          pathname.startsWith(item.href + "/") ||
                          (item.href === "/inventory" &&
                            (pathname.startsWith("/reservations") ||
                              pathname.startsWith("/inventory/reservations")))

                    const hasChildren = Boolean(item.items?.length)

                    return (
                      <LayoutComposer.Entry
                        id={`nav:${item.href}`}
                        key={item.href}
                      >
                        <div className="flex flex-col gap-y-0.5">
                          <Link
                            href={item.href}
                            className={clx(
                              BASE_NAV_LINK_CLASSES,
                              isExactParentActive && ACTIVE_NAV_LINK_CLASSES
                            )}
                          >
                            <div className="flex size-6 items-center justify-center">
                              <Icon />
                            </div>
                            <Text
                              size="small"
                              weight="plus"
                              leading="compact"
                              className="truncate"
                            >
                              {item.label}
                            </Text>
                          </Link>

                          {/* Sub-items rendered cleanly when section is active */}
                          {hasChildren && isSectionActive && (
                            <div className="flex flex-col gap-y-0.5 pb-1 pt-0.5">
                              {item.items!.map((subItem) => {
                                const isSubActive =
                                  pathname === subItem.href ||
                                  pathname.startsWith(subItem.href + "/")

                                return (
                                  <Link
                                    key={subItem.href}
                                    href={subItem.href}
                                    className={clx(
                                      NESTED_NAV_LINK_CLASSES,
                                      isSubActive && NESTED_ACTIVE_CLASSES
                                    )}
                                  >
                                    <Text
                                      size="small"
                                      weight={isSubActive ? "plus" : "regular"}
                                      leading="compact"
                                    >
                                      {subItem.label}
                                    </Text>
                                  </Link>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </LayoutComposer.Entry>
                    )
                  })}
                </>
              ),
            }}
          />
        </nav>
      </div>

      <div className="flex flex-col gap-y-1 p-3 shrink-0">
        <Link
          href="/settings"
          className={clx(
            BASE_NAV_LINK_CLASSES,
            pathname.startsWith("/settings") && ACTIVE_NAV_LINK_CLASSES
          )}
        >
          <div className="flex size-6 items-center justify-center">
            <CogSixTooth />
          </div>
          <Text size="small" weight="plus" leading="compact">
            Settings
          </Text>
        </Link>

        <div className="border-ui-border-base border-t border-dashed my-1" />

        <UserMenu name={name} email={email} />
      </div>
    </aside>
  )
}
