"use client"

import { SidebarLeft } from "@medusajs/icons"
import { IconButton, Text } from "@medusajs/ui"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { getVendorCapabilities, isRouteAllowed } from "@lib/permissions/feature-access"
import { Sidebar } from "./sidebar"
import { SettingsSidebar } from "./settings-sidebar"
import {
  CustomizerMenu,
  LayoutComposer,
  LayoutCustomizerHostProvider,
  LayoutCustomizerSlot,
  CUSTOMIZE_IDS,
  LAYOUT_CONTROLS_LOCATION,
  CORE_LAYOUT_IDS,
} from "../layout-composer"
import { Notifications } from "../notifications"
import { SearchProvider } from "../search"
import { useVendorOnboardingStatus } from "@modules/onboarding"
import { ArrowRight, Clock, ExclamationCircle, Sparkles, TriangleRightMini } from "@medusajs/icons"

/**
 * Labels for the fixed segments of a path. Anything not listed - a product id,
 * say - is resolved at render time by whatever page is showing it.
 */
const SEGMENT_LABELS: Record<string, string> = {
  products: "Products",
  orders: "Orders",
  drafts: "Draft Orders",
  "draft-orders": "Draft Orders",
  collections: "Collections",
  categories: "Categories",
  options: "Product Options",
  inventory: "Inventory",
  reservations: "Reservations",
  customers: "Customers",
  groups: "Customer Groups",
  "customer-groups": "Customer Groups",
  pricing: "Price Lists",
  "price-lists": "Price Lists",
  promotions: "Promotions",
  campaigns: "Campaigns",
  earnings: "Earnings",
  venues: "Venues",
  shows: "Shows",
  "my-schedule": "My Schedule",
  dashboard: "Commerce Infrastructure",
  "commerce-infra": "Commerce Infrastructure",
  settings: "Settings",
  store: "Store",
  locations: "Locations",
  profile: "Profile",
  "return-reasons": "Return Reasons",
  "refund-reasons": "Refund Reasons",
  new: "Create",
  create: "Create",
  edit: "Edit",
  onboarding: "Onboarding",
}

type Crumb = { label: string; href?: string }

/**
 * Lets a page name the record it is showing, so the breadcrumb can read
 * "Products › Medusa Sweatpants" rather than "Products › prod_01ABC…".
 */
const TitleContext = createContext<(title: string | null) => void>(() => {})

export const useBreadcrumbTitle = (title: string | null | undefined) => {
  const setTitle = useContext(TitleContext)

  useEffect(() => {
    setTitle(title ?? null)
    return () => setTitle(null)
  }, [title, setTitle])
}

const getCanonicalCrumbs = (pathname: string, recordTitle: string | null): Crumb[] => {
  // 1. Root and Dashboard
  if (pathname === "/dashboard" || pathname === "/commerce-infra") {
    return [{ label: "Commerce Infrastructure" }]
  }

  // 2. Draft Orders
  if (pathname === "/orders/drafts") {
    return [{ label: "Draft Orders" }]
  }
  if (pathname.startsWith("/orders/drafts/")) {
    const rest = pathname.replace("/orders/drafts/", "")
    return [
      { label: "Draft Orders", href: "/orders/drafts" },
      { label: rest === "new" ? "Create" : (recordTitle ?? rest) },
    ]
  }

  // 3. Earnings
  if (pathname === "/orders/earnings") {
    return [{ label: "Earnings" }]
  }

  // 4. Orders
  if (pathname === "/orders") {
    return [{ label: "Orders" }]
  }
  if (pathname.startsWith("/orders/")) {
    const rest = pathname.replace("/orders/", "")
    return [
      { label: "Orders", href: "/orders" },
      { label: recordTitle ?? rest },
    ]
  }

  // 5. Collections
  if (pathname === "/products/collections") {
    return [{ label: "Collections" }]
  }
  if (pathname.startsWith("/products/collections/")) {
    const rest = pathname.replace("/products/collections/", "")
    return [
      { label: "Collections", href: "/products/collections" },
      { label: rest === "new" ? "Create" : (recordTitle ?? rest) },
    ]
  }

  // 6. Categories
  if (pathname === "/products/categories") {
    return [{ label: "Categories" }]
  }
  if (pathname.startsWith("/products/categories/")) {
    const rest = pathname.replace("/products/categories/", "")
    return [
      { label: "Categories", href: "/products/categories" },
      { label: rest === "new" ? "Create" : (recordTitle ?? rest) },
    ]
  }

  // 7. Product Options
  if (pathname === "/products/options") {
    return [{ label: "Product Options" }]
  }
  if (pathname.startsWith("/products/options/")) {
    const rest = pathname.replace("/products/options/", "")
    return [
      { label: "Product Options", href: "/products/options" },
      { label: rest === "new" ? "Create" : (recordTitle ?? rest) },
    ]
  }

  // 8. Products
  if (pathname === "/products") {
    return [{ label: "Products" }]
  }
  if (pathname.startsWith("/products/")) {
    const rest = pathname.replace("/products/", "")
    return [
      { label: "Products", href: "/products" },
      { label: rest === "new" ? "Create" : (recordTitle ?? rest) },
    ]
  }

  // 9. Reservations
  if (pathname === "/inventory/reservations" || pathname === "/reservations") {
    return [{ label: "Reservations" }]
  }
  if (pathname.startsWith("/inventory/reservations/")) {
    const rest = pathname.replace("/inventory/reservations/", "")
    return [
      { label: "Reservations", href: "/inventory/reservations" },
      { label: rest === "new" ? "Create" : (recordTitle ?? rest) },
    ]
  }

  // 10. Inventory
  if (pathname === "/inventory") {
    return [{ label: "Inventory" }]
  }
  if (pathname.startsWith("/inventory/")) {
    const rest = pathname.replace("/inventory/", "")
    return [
      { label: "Inventory", href: "/inventory" },
      { label: rest === "new" ? "Create" : (recordTitle ?? rest) },
    ]
  }

  // 11. Customer Groups
  if (pathname === "/customers/groups") {
    return [{ label: "Customer Groups" }]
  }
  if (pathname.startsWith("/customers/groups/")) {
    const rest = pathname.replace("/customers/groups/", "")
    return [
      { label: "Customer Groups", href: "/customers/groups" },
      { label: rest === "new" ? "Create" : (recordTitle ?? rest) },
    ]
  }

  // 12. Customers
  if (pathname === "/customers") {
    return [{ label: "Customers" }]
  }
  if (pathname.startsWith("/customers/")) {
    const rest = pathname.replace("/customers/", "")
    return [
      { label: "Customers", href: "/customers" },
      { label: recordTitle ?? rest },
    ]
  }

  // 13. Campaigns
  if (pathname === "/promotions/campaigns" || pathname === "/campaigns") {
    return [{ label: "Campaigns" }]
  }
  if (pathname.startsWith("/promotions/campaigns/")) {
    const rest = pathname.replace("/promotions/campaigns/", "")
    return [
      { label: "Campaigns", href: "/promotions/campaigns" },
      { label: rest === "new" ? "Create" : (recordTitle ?? rest) },
    ]
  }

  // 14. Promotions
  if (pathname === "/promotions") {
    return [{ label: "Promotions" }]
  }
  if (pathname.startsWith("/promotions/")) {
    const rest = pathname.replace("/promotions/", "")
    return [
      { label: "Promotions", href: "/promotions" },
      { label: rest === "new" ? "Create" : (recordTitle ?? rest) },
    ]
  }

  // 15. Price Lists
  if (pathname === "/pricing") {
    return [{ label: "Price Lists" }]
  }
  if (pathname.startsWith("/pricing/")) {
    const rest = pathname.replace("/pricing/", "")
    return [
      { label: "Price Lists", href: "/pricing" },
      { label: rest === "new" ? "Create" : (recordTitle ?? rest) },
    ]
  }

  // 16. Fallback
  const segments = pathname.split("/").filter(Boolean)
  return segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/")
    const known = SEGMENT_LABELS[segment]
    return {
      label: known ?? (recordTitle ?? segment),
      href: index < segments.length - 1 ? href : undefined,
    }
  })
}

const Breadcrumbs = ({ recordTitle }: { recordTitle: string | null }) => {
  const pathname = usePathname()
  const crumbs = getCanonicalCrumbs(pathname, recordTitle)

  if (!crumbs.length) {
    return null
  }

  return (
    <ol className="text-ui-fg-muted txt-compact-small-plus flex select-none items-center">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1
        const isSingle = crumbs.length === 1

        return (
          <li key={crumb.href ?? index} className="flex items-center">
            {!isLast && crumb.href ? (
              <Link
                className="transition-fg hover:text-ui-fg-subtle"
                href={crumb.href}
              >
                {crumb.label}
              </Link>
            ) : (
              <div>
                {!isSingle && <span className="block lg:hidden">...</span>}
                <span className={!isSingle ? "hidden lg:block" : ""}>
                  {crumb.label}
                </span>
              </div>
            )}
            {!isLast && (
              <span className="mx-2">
                <TriangleRightMini className="rtl:rotate-180" aria-hidden />
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/**
 * The signed-in shell: collapsible sidebar, top bar with breadcrumbs,
 * layout customization controls, notifications feed, and page content.
 */
export const PanelShell = ({
  storeName,
  email,
  name,
  children,
}: {
  storeName: string
  email: string
  name: string | null
  children: React.ReactNode
}) => {
  const [collapsed, setCollapsed] = useState(false)
  const [recordTitle, setRecordTitle] = useState<string | null>(null)

  useEffect(() => {
    try {
      setCollapsed(
        window.localStorage.getItem("vendor-sidebar-collapsed") === "true"
      )
    } catch {
      // ignore
    }
  }, [])

  const toggle = () => {
    setCollapsed((previous) => {
      const next = !previous
      try {
        window.localStorage.setItem("vendor-sidebar-collapsed", String(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  const router = useRouter()
  const pathname = usePathname()
  const { data: onboarding, isLoading: isOnboardingLoading } = useVendorOnboardingStatus()

  const isOnboarding = pathname === "/onboarding"
  const isApproved = onboarding?.status === "APPROVED"
  const isSettings = pathname.startsWith("/settings") && isApproved

  // Gatekeeper: Non-approved vendors are restricted strictly to /onboarding
  useEffect(() => {
    if (!isOnboardingLoading && onboarding && !isApproved && !isOnboarding) {
      router.replace("/onboarding")
    }
  }, [isOnboardingLoading, onboarding, isApproved, isOnboarding, router])

  // Capability gate: the flags decide which sidebar items show, but typing a URL
  // such as /venues used to open the page anyway. An approved seller whose
  // capabilities do not include a route is sent back to the orders list.
  const capabilities = useMemo(() => getVendorCapabilities(onboarding), [onboarding])

  useEffect(() => {
    if (isOnboardingLoading || !onboarding || !isApproved) {
      return
    }

    if (!isRouteAllowed(pathname, capabilities)) {
      router.replace("/orders")
    }
  }, [isOnboardingLoading, onboarding, isApproved, pathname, capabilities, router])

  const showOnboardingBanner =
    !isOnboarding && onboarding && onboarding.status !== "APPROVED"

  return (
    <SearchProvider>
      <LayoutCustomizerHostProvider>
        <TitleContext.Provider value={setRecordTitle}>
          <div className="flex h-screen w-full overflow-hidden">
            {collapsed ? null : isSettings ? (
              <SettingsSidebar email={email} name={name} />
            ) : (
              <Sidebar storeName={storeName} email={email} name={name} />
            )}
            <div className="flex flex-1 flex-col overflow-hidden">
              <header className="border-ui-border-base bg-ui-bg-subtle flex h-12 shrink-0 items-center justify-between border-b px-4">
                <div className="flex items-center gap-x-1.5 overflow-hidden">
                  <IconButton
                    size="small"
                    variant="transparent"
                    onClick={toggle}
                    aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
                  >
                    <SidebarLeft className="text-ui-fg-muted rtl:rotate-180" />
                  </IconButton>
                  <Breadcrumbs recordTitle={recordTitle} />
                </div>

                {/* Top-Right Header Tools: Customize Layout & Notifications */}
                <div className="flex items-center gap-x-2 shrink-0">
                  <CustomizerMenu />
                  <LayoutCustomizerSlot location={LAYOUT_CONTROLS_LOCATION} />
                  <LayoutComposer
                    widgetsZonePrefix="topbar"
                    preferredLayoutId={CORE_LAYOUT_IDS.SINGLE_ROW}
                    customizeId={CUSTOMIZE_IDS.TOPBAR}
                    controlSize="xsmall"
                    sections={{
                      main: (
                        <LayoutComposer.Entry id="Notifications">
                          <Notifications />
                        </LayoutComposer.Entry>
                      ),
                    }}
                  />
                </div>
              </header>

              {/* Onboarding Gatekeeper Banner */}
              {showOnboardingBanner && (
                <div
                  className={`px-4 py-2 flex items-center justify-between text-xs border-b shrink-0 ${
                    onboarding.status === "REJECTED"
                      ? "bg-ui-bg-error/10 border-ui-border-error/30 text-ui-fg-error"
                      : onboarding.status === "SUBMITTED" ||
                        onboarding.status === "UNDER_REVIEW"
                      ? "bg-ui-bg-interactive/10 border-ui-border-interactive/30 text-ui-fg-interactive"
                      : "bg-ui-bg-interactive/5 border-ui-border-interactive/20 text-ui-fg-base"
                  }`}
                >
                  <div className="flex items-center gap-x-2 truncate">
                    {onboarding.status === "REJECTED" ? (
                      <ExclamationCircle className="h-4 w-4 shrink-0 text-ui-fg-error" />
                    ) : onboarding.status === "SUBMITTED" ||
                      onboarding.status === "UNDER_REVIEW" ? (
                      <Clock className="h-4 w-4 shrink-0 text-ui-fg-interactive" />
                    ) : (
                      <Sparkles className="h-4 w-4 shrink-0 text-ui-fg-interactive" />
                    )}
                    <span className="font-medium truncate">
                      {onboarding.status === "REJECTED"
                        ? "Action Required: Your merchant onboarding application requires revisions."
                        : onboarding.status === "SUBMITTED" ||
                          onboarding.status === "UNDER_REVIEW"
                        ? "Application Under Review: Compliance verification is in progress. Dashboard unlocks upon approval."
                        : "Complete Onboarding: Finish your store profile to submit for administrator approval."}
                    </span>
                  </div>
                  <Link
                    href="/onboarding"
                    className="font-semibold underline shrink-0 hover:opacity-80 flex items-center gap-x-1 ml-4"
                  >
                    {onboarding.status === "REJECTED"
                      ? "Review & Resubmit"
                      : onboarding.status === "SUBMITTED" ||
                        onboarding.status === "UNDER_REVIEW"
                      ? "View Status"
                      : "Complete Setup"}{" "}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}

              <main className="flex-1 overflow-y-auto">
                {isOnboardingLoading ? (
                  <div className="flex flex-col items-center justify-center min-h-[60vh] gap-y-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-3 border-ui-border-interactive border-t-transparent" />
                  </div>
                ) : !isApproved && !isOnboarding ? (
                  <div className="flex flex-col items-center justify-center min-h-[60vh] gap-y-4">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-ui-border-interactive border-t-transparent" />
                    <Text size="small" className="text-ui-fg-subtle">
                      Redirecting to onboarding...
                    </Text>
                  </div>
                ) : (
                  children
                )}
              </main>
            </div>
          </div>
        </TitleContext.Provider>
      </LayoutCustomizerHostProvider>
    </SearchProvider>
  )
}
