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
  Sparkles,
  ServerStack,
} from "@medusajs/icons"
import { clx, Text } from "@medusajs/ui"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { UserMenu } from "./user-menu"
import { StoreHeaderDropdown } from "./store-header-dropdown"
import {
  LayoutComposer,
  CUSTOMIZE_IDS,
  CORE_LAYOUT_IDS,
} from "../layout-composer"
import { Searchbar } from "../search"
import { useVendorOnboardingStatus } from "@modules/onboarding"

type NavChild = {
  href: string
  label: string
  // Only highlight on the exact path (for "overview" style entries).
  exact?: boolean
  // Other paths that also belong to this entry.
  aliases?: string[]
  items?: { href: string; label: string }[]
}

type NavGroup = {
  href: string
  label: string
  icon: any
  children?: NavChild[]
}

// Grouped like the admin panel: Commerce Infra holds the shop pages and each
// business area is its own group with its pages nested inside.
const NAV_ITEMS: NavGroup[] = [
  {
    href: "/dashboard",
    label: "Commerce Infra",
    icon: ServerStack,
    children: [
      {
        href: "/orders",
        label: "Orders",
        items: [
          { href: "/orders/drafts", label: "Drafts" },
          { href: "/orders/earnings", label: "Earnings" },
        ],
      },
      {
        href: "/products",
        label: "Products",
        items: [
          { href: "/products/collections", label: "Collections" },
          { href: "/products/categories", label: "Categories" },
          { href: "/products/options", label: "Options" },
        ],
      },
      {
        href: "/inventory",
        label: "Inventory",
        aliases: ["/reservations"],
        items: [{ href: "/reservations", label: "Reservations" }],
      },
      {
        href: "/customers",
        label: "Customers",
        items: [{ href: "/customers/groups", label: "Customer Groups" }],
      },
      {
        href: "/promotions",
        label: "Promotions",
        items: [{ href: "/promotions/campaigns", label: "Campaigns" }],
      },
      { href: "/pricing", label: "Price Lists" },
    ],
  },
  {
    href: "/venues",
    label: "Events",
    icon: Calendar,
    children: [
      { href: "/venues", label: "Venues" },
      { href: "/shows", label: "Shows" },
    ],
  },
  {
    href: "/appointments",
    label: "Booking",
    icon: Calendar,
    children: [
      { href: "/appointments", label: "Overview", exact: true },
      { href: "/appointments/resources", label: "Resources" },
      { href: "/appointments/pricing-rules", label: "Pricing Rules" },
      { href: "/appointments/bookings", label: "Bookings" },
      { href: "/my-schedule", label: "My Schedule" },
    ],
  },
  {
    href: "/restaurants",
    label: "Restaurants",
    icon: ChefHat,
    children: [
      { href: "/restaurants", label: "Overview & Menu", exact: true },
      { href: "/restaurants/deliveries", label: "Live Deliveries" },
    ],
  },
  {
    href: "/b2b",
    label: "B2B",
    icon: BuildingStorefront,
    children: [
      { href: "/b2b/quotes", label: "Quotes" },
      { href: "/b2b/companies", label: "Companies" },
      { href: "/b2b/approvals", label: "Approvals" },
    ],
  },
  { href: "/digital-products", label: "Digital Products", icon: DocumentText },
  // Enquiries hang off products, so they follow the Products capability.
  { href: "/enquiries", label: "Enquiries", icon: ChatBubbleLeftRight },
]

const pathMatches = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(href + "/")

const isChildActive = (pathname: string, child: NavChild) =>
  child.exact
    ? pathname === child.href
    : pathMatches(pathname, child.href) ||
      Boolean(child.aliases?.some((a) => pathMatches(pathname, a))) ||
      Boolean(child.items?.some((i) => pathMatches(pathname, i.href)))

// The child itself is the current page, not one of its sub-items.
const isChildExactActive = (pathname: string, child: NavChild) =>
  isChildActive(pathname, child) &&
  !child.items?.some((i) => pathMatches(pathname, i.href))

const isGroupActive = (pathname: string, group: NavGroup) => {
  if (group.href === "/dashboard" &&
      (pathname === "/dashboard" || pathname === "/commerce-infra")) {
    return true
  }
  return group.children?.length
    ? group.children.some((c) => isChildActive(pathname, c))
    : pathMatches(pathname, group.href)
}

const BASE_NAV_LINK_CLASSES =
  "text-ui-fg-subtle transition-fg hover:bg-ui-bg-subtle-hover flex items-center gap-x-2 rounded-md py-0.5 pl-0.5 pr-2 outline-none [&>svg]:text-ui-fg-subtle focus-visible:shadow-borders-focus"
const ACTIVE_NAV_LINK_CLASSES =
  "bg-ui-bg-base shadow-elevation-card-rest text-ui-fg-base hover:bg-ui-bg-base"
const NESTED_NAV_LINK_CLASSES =
  "pl-[34px] pr-2 py-1 w-full text-ui-fg-muted hover:text-ui-fg-base transition-fg text-small"
const NESTED_SUB_LINK_CLASSES =
  "pl-[52px] pr-2 py-1 w-full text-ui-fg-muted hover:text-ui-fg-base transition-fg text-small"
const NESTED_ACTIVE_CLASSES =
  "text-ui-fg-base font-semibold"

type SidebarProps = {
  storeName: string
  email: string
  name: string | null
}

export const Sidebar = ({ storeName, email, name }: SidebarProps) => {
  const pathname = usePathname()
  // Groups the user closed by hand. Cleared on navigation so the group you
  // move into opens again.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  useEffect(() => setCollapsed({}), [pathname])
  const { data: onboarding } = useVendorOnboardingStatus()

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

    return NAV_ITEMS
  }, [onboarding])

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
                    const groupActive = isGroupActive(pathname, item)
                    const hasChildren = Boolean(item.children?.length)
                    const isOpen = groupActive && !collapsed[item.href]

                    return (
                      <LayoutComposer.Entry
                        id={`nav:${item.href}`}
                        key={item.href}
                      >
                        <div className="flex flex-col gap-y-0.5">
                          <Link
                            href={item.href}
                            onClick={(e) => {
                              // Clicking an open group closes it instead of reloading the page.
                              if (hasChildren && groupActive) {
                                e.preventDefault()
                                setCollapsed((c) => ({
                                  ...c,
                                  [item.href]: !c[item.href],
                                }))
                              }
                            }}
                            className={clx(
                              BASE_NAV_LINK_CLASSES,
                              groupActive && ACTIVE_NAV_LINK_CLASSES
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

                          {hasChildren && isOpen && (
                            <div className="flex flex-col gap-y-0.5 pb-1 pt-0.5">
                              {item.children!.map((child) => {
                                const childActive = isChildActive(pathname, child)
                                const childExact = isChildExactActive(pathname, child)

                                return (
                                  <div key={child.href} className="flex flex-col gap-y-0.5">
                                    <Link
                                      href={child.href}
                                      className={clx(
                                        NESTED_NAV_LINK_CLASSES,
                                        childExact && NESTED_ACTIVE_CLASSES
                                      )}
                                    >
                                      <Text
                                        size="small"
                                        weight={childExact ? "plus" : "regular"}
                                        leading="compact"
                                      >
                                        {child.label}
                                      </Text>
                                    </Link>

                                    {childActive &&
                                      child.items?.map((subItem) => {
                                        const isSubActive = pathMatches(
                                          pathname,
                                          subItem.href
                                        )
                                        return (
                                          <Link
                                            key={subItem.href}
                                            href={subItem.href}
                                            className={clx(
                                              NESTED_SUB_LINK_CLASSES,
                                              isSubActive && NESTED_ACTIVE_CLASSES
                                            )}
                                          >
                                            <Text
                                              size="small"
                                              weight={isSubActive ? "plus" : "regular"}
                                              leading="compact"
                                            >
                                              └ {subItem.label}
                                            </Text>
                                          </Link>
                                        )
                                      })}
                                  </div>
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
