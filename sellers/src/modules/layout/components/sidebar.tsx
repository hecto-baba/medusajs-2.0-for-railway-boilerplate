"use client"

import {
  Buildings,
  BuildingStorefront,
  Calendar,
  ChevronDownMini,
  CogSixTooth,
  CurrencyDollar,
  ReceiptPercent,
  ShoppingCart,
  Sparkles,
  Tag,
  Users,
} from "@medusajs/icons"
import { Avatar, Badge, Text } from "@medusajs/ui"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { UserMenu } from "./user-menu"
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
    href: "/orders",
    label: "Orders",
    icon: ShoppingCart,
    items: [{ href: "/orders/drafts", label: "Drafts" }],
  },
  {
    href: "/products",
    label: "Products",
    icon: Tag,
    items: [
      { href: "/products/collections", label: "Collections" },
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
  { href: "/pricing", label: "Price Lists", icon: CurrencyDollar },
  {
    href: "/promotions",
    label: "Promotions",
    icon: ReceiptPercent,
    items: [{ href: "/promotions/campaigns", label: "Campaigns" }],
  },
  { href: "/venues", label: "Venues", icon: Buildings },
  { href: "/shows", label: "Shows", icon: Calendar },
]

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
      if (item.href === "/inventory" && !capabilities.hasInventory) return false
      if (item.href === "/pricing" && !capabilities.hasPricing) return false
      if (item.href === "/promotions" && !capabilities.hasPromotions) return false
      if (item.href === "/venues" && !capabilities.hasVenues) return false
      if (item.href === "/shows" && !capabilities.hasShows) return false
      return true
    })

    return filtered
  }, [capabilities, onboarding])

  // Track expanded state for items with sub-menus
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "/orders": true,
    "/products": true,
    "/inventory": true,
    "/customers": true,
    "/promotions": true,
  })

  // Automatically keep parent expanded if child route is active
  useEffect(() => {
    visibleNavItems.forEach((item) => {
      if (
        item.items &&
        (pathname.startsWith(item.href) ||
          (item.href === "/inventory" &&
            (pathname.startsWith("/reservations") ||
              pathname.startsWith("/inventory/reservations"))))
      ) {
        setExpanded((prev) => ({ ...prev, [item.href]: true }))
      }
    })
  }, [pathname, visibleNavItems])

  const toggleExpand = (href: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setExpanded((prev) => ({ ...prev, [href]: !prev[href] }))
  }

  const verticalLabel = onboarding?.segment?.name || null
  const vendorTypeLabel = onboarding?.vendorType?.code || null

  return (
    <aside className="bg-ui-bg-subtle border-ui-border-base flex h-screen w-[220px] shrink-0 flex-col justify-between border-r">
      <div className="flex flex-col gap-y-4 p-3 overflow-y-auto">
        <div className="flex flex-col gap-y-1 px-2 py-1">
          <div className="flex items-center gap-x-2">
            <Avatar fallback={storeName.charAt(0).toUpperCase()} size="small" />
            <Text size="small" weight="plus" className="text-ui-fg-base truncate">
              {storeName}
            </Text>
          </div>
          {verticalLabel && (
            <div className="flex items-center gap-x-1 pl-7">
              <Badge size="xsmall" color="blue" className="text-[9px] py-0 px-1 truncate">
                {verticalLabel} {vendorTypeLabel ? `• ${vendorTypeLabel}` : ""}
              </Badge>
            </div>
          )}
        </div>

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
                      item.href === "/orders"
                        ? pathname === "/orders" ||
                          (pathname.startsWith("/orders/") &&
                            !pathname.startsWith("/orders/drafts"))
                        : item.href === "/products"
                        ? pathname === "/products" ||
                          (pathname.startsWith("/products/") &&
                            !pathname.startsWith("/products/collections") &&
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
                        : pathname.startsWith(item.href)

                    const isSectionActive =
                      pathname.startsWith(item.href) ||
                      (item.href === "/inventory" &&
                        (pathname.startsWith("/reservations") ||
                          pathname.startsWith("/inventory/reservations")))
                    const hasChildren = Boolean(item.items?.length)
                    const isExpanded = expanded[item.href] ?? isSectionActive

                    return (
                      <LayoutComposer.Entry
                        id={`nav:${item.href}`}
                        key={item.href}
                      >
                        <div className="flex flex-col gap-y-0.5">
                          <div
                            className={`flex items-center justify-between rounded-md transition-fg ${
                              isExactParentActive
                                ? "bg-ui-bg-base shadow-elevation-card-rest text-ui-fg-base font-medium"
                                : isSectionActive
                                ? "text-ui-fg-base font-medium"
                                : "text-ui-fg-subtle hover:bg-ui-bg-base-hover hover:text-ui-fg-base"
                            }`}
                          >
                            <Link
                              href={item.href}
                              className="flex flex-1 items-center gap-x-2 px-2 py-1.5"
                            >
                              <Icon />
                              <Text
                                size="small"
                                weight={
                                  isExactParentActive || isSectionActive
                                    ? "plus"
                                    : "regular"
                                }
                              >
                                {item.label}
                              </Text>
                            </Link>

                            {hasChildren && (
                              <button
                                type="button"
                                onClick={(e) => toggleExpand(item.href, e)}
                                className="text-ui-fg-muted hover:text-ui-fg-base p-1.5 mr-1 rounded transition-colors"
                                aria-label={`Toggle ${item.label} sub-items`}
                              >
                                <ChevronDownMini
                                  className={`h-4 w-4 transition-transform duration-150 ${
                                    isExpanded ? "rotate-0" : "-rotate-90"
                                  }`}
                                />
                              </button>
                            )}
                          </div>

                          {/* Sub-items */}
                          {hasChildren && isExpanded && (
                            <div className="flex flex-col gap-y-0.5 pl-6 pr-1 pt-0.5">
                              {item.items!.map((subItem) => {
                                const isSubActive = pathname.startsWith(
                                  subItem.href
                                )

                                return (
                                  <Link
                                    key={subItem.href}
                                    href={subItem.href}
                                    className={`flex items-center rounded-md px-2 py-1 text-xs transition-fg ${
                                      isSubActive
                                        ? "bg-ui-bg-base text-ui-fg-base font-semibold shadow-elevation-card-rest"
                                        : "text-ui-fg-muted hover:bg-ui-bg-base-hover hover:text-ui-fg-base"
                                    }`}
                                  >
                                    {subItem.label}
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

      <div className="flex flex-col gap-y-2 p-3">
        <Link
          href="/settings"
          className={`flex items-center gap-x-2 rounded-md px-2 py-1.5 transition-fg ${
            pathname.startsWith("/settings")
              ? "bg-ui-bg-base shadow-elevation-card-rest text-ui-fg-base"
              : "text-ui-fg-subtle hover:bg-ui-bg-base-hover"
          }`}
        >
          <CogSixTooth />
          <Text
            size="small"
            weight={pathname.startsWith("/settings") ? "plus" : "regular"}
          >
            Settings
          </Text>
        </Link>

        <div className="border-ui-border-strong border-t border-dashed" />

        <UserMenu name={name} email={email} />
      </div>
    </aside>
  )
}
