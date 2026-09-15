"use client"

import { SidebarLeft } from "@medusajs/icons"
import { IconButton, Text } from "@medusajs/ui"
import Link from "next/link"
import { usePathname } from "next/navigation"
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

  const pathname = usePathname()
  const isSettings = pathname.startsWith("/settings")

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
              <main className="flex-1 overflow-y-auto">{children}</main>
            </div>
          </div>
        </TitleContext.Provider>
      </LayoutCustomizerHostProvider>
    </SearchProvider>
  )
}
