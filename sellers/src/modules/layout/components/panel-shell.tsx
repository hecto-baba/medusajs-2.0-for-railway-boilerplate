"use client"

import { SidebarLeft } from "@medusajs/icons"
import { IconButton, Text } from "@medusajs/ui"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createContext, useContext, useEffect, useState } from "react"
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
import { ArrowRight, Clock, ExclamationCircle, Sparkles } from "@medusajs/icons"

/**
 * Labels for the fixed segments of a path. Anything not listed - a product id,
 * say - is resolved at render time by whatever page is showing it.
 */
const SEGMENT_LABELS: Record<string, string> = {
  products: "Products",
  orders: "Orders",
  dashboard: "Dashboard",
  settings: "Settings",
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

const Breadcrumbs = ({ recordTitle }: { recordTitle: string | null }) => {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)

  if (!segments.length) {
    return null
  }

  const crumbs: Crumb[] = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/")
    const known = SEGMENT_LABELS[segment]

    if (known) {
      return { label: known, href }
    }

    return {
      label: recordTitle ?? segment.slice(0, 12) + "…",
      href,
    }
  })

  return (
    <nav className="flex items-center gap-x-2 overflow-hidden">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1

        return (
          <div key={crumb.href ?? index} className="flex items-center gap-x-2">
            {index > 0 ? (
              <span className="text-ui-fg-muted" aria-hidden>
                ›
              </span>
            ) : null}
            {isLast || !crumb.href ? (
              <Text size="small" className="text-ui-fg-base truncate">
                {crumb.label}
              </Text>
            ) : (
              <Link href={crumb.href}>
                <Text
                  size="small"
                  className="text-ui-fg-subtle hover:text-ui-fg-base truncate"
                >
                  {crumb.label}
                </Text>
              </Link>
            )}
          </div>
        )
      })}
    </nav>
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
                <div className="flex items-center gap-x-3 overflow-hidden">
                  <IconButton
                    size="small"
                    variant="transparent"
                    onClick={toggle}
                    aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
                  >
                    <SidebarLeft />
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
