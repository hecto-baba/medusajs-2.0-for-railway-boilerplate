"use client"

import { SidebarLeft } from "@medusajs/icons"
import { IconButton, Text } from "@medusajs/ui"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { createContext, useContext, useEffect, useState } from "react"
import { Sidebar } from "./sidebar"

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
 *
 * A context rather than a prop because the title is only known once the page
 * has fetched its data, which happens well below the shell.
 */
const TitleContext = createContext<(title: string | null) => void>(() => {})

/**
 * Registers the current record's title with the breadcrumb.
 *
 * Clears on unmount so a stale title cannot leak onto the next page - without
 * that, navigating from one product to another briefly shows the old name.
 */
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

    // An unrecognised segment is an id. Use the record's title when the page
    // has supplied one, and fall back to a truncated id rather than showing a
    // 30-character ULID in the bar.
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
 * The signed-in shell: collapsible sidebar, a top bar with breadcrumbs, and
 * the page below it.
 *
 * Collapsed state is kept in localStorage so it survives navigation and
 * reloads - a sidebar that springs back open on every page change is worse
 * than one that never collapsed.
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

  // Read after mount rather than in the initial state: the server render has
  // no localStorage, and seeding from it directly would mismatch on hydration.
  useEffect(() => {
    try {
      setCollapsed(
        window.localStorage.getItem("vendor-sidebar-collapsed") === "true"
      )
    } catch {
      // Private windows and blocked site data throw on access; the default
      // (expanded) is the right fallback.
    }
  }, [])

  const toggle = () => {
    setCollapsed((previous) => {
      const next = !previous

      try {
        window.localStorage.setItem("vendor-sidebar-collapsed", String(next))
      } catch {
        // Not being able to remember the choice is not a reason to refuse it.
      }

      return next
    })
  }

  return (
    <TitleContext.Provider value={setRecordTitle}>
      <div className="flex h-screen w-full overflow-hidden">
        {collapsed ? null : (
          <Sidebar storeName={storeName} email={email} name={name} />
        )}
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="border-ui-border-base bg-ui-bg-subtle flex h-12 shrink-0 items-center gap-x-3 border-b px-4">
            <IconButton
              size="small"
              variant="transparent"
              onClick={toggle}
              aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
            >
              <SidebarLeft />
            </IconButton>
            <Breadcrumbs recordTitle={recordTitle} />
          </header>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </TitleContext.Provider>
  )
}
