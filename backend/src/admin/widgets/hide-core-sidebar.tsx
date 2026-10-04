import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect } from "react"
import { useLocation } from "react-router-dom"

// Core sidebar entries (and their sub-items) that are grouped under
// "Commerce Infra" instead. Pages stay reachable; only the core sidebar
// blocks are hidden.
const HIDDEN_PATHS = [
  "/orders",
  "/products",
  "/collections",
  "/categories",
  "/product-options",
  "/inventory",
  "/reservations",
  "/customers",
  "/customer-groups",
  "/promotions",
  "/campaigns",
  "/price-lists",
]

// Core page -> its Commerce Infra sidebar entry.
const CORE_TO_INFRA: Record<string, string> = {
  "/orders": "/commerce-infra/orders",
  "/products": "/commerce-infra/products",
  "/collections": "/commerce-infra/collections",
  "/categories": "/commerce-infra/categories",
  "/product-options": "/commerce-infra/product-options",
  "/inventory": "/commerce-infra/inventory",
  "/reservations": "/commerce-infra/reservations",
  "/customers": "/commerce-infra/customers",
  "/customer-groups": "/commerce-infra/customer-groups",
  "/promotions": "/commerce-infra/promotions",
  "/campaigns": "/commerce-infra/campaigns",
  "/price-lists": "/commerce-infra/price-lists",
}

// Commerce Infra entries shown as children of another entry.
const INDENTED = [
  "/commerce-infra/collections",
  "/commerce-infra/categories",
  "/commerce-infra/product-options",
  "/commerce-infra/reservations",
  "/commerce-infra/customer-groups",
  "/commerce-infra/campaigns",
]

const STYLE_ID = "hide-core-sidebar-style"
const ACTIVE_ATTR = "data-ci-active"

const buildCss = () => {
  // A core NavItem is `div > (div.w-full > a) + collapsible(sub-items)`, so
  // matching the wrapper hides the link and its sub-items together.
  const hide = HIDDEN_PATHS.flatMap((path) => [
    `nav div:has(> div > a[href="${path}"])`,
    `nav div:has(> div > a[href="/app${path}"])`,
  ]).join(",\n")

  const indent = INDENTED.map((p) => `nav a[href$="${p}"]`).join(",\n")

  return `
${hide} { display: none !important; }

${indent} {
  padding-left: 52px !important;
  position: relative;
}
${INDENTED.map((p) => `nav a[href$="${p}"]::before`).join(",\n")} {
  content: "└";
  position: absolute;
  left: 36px;
  opacity: 0.5;
}

nav a[${ACTIVE_ATTR}] {
  background: var(--bg-base);
  color: var(--fg-base);
}
`
}

// Keeps the Commerce Infra group open and highlights the matching entry
// while the user is on a core page that lives under it.
const syncSidebar = (pathname: string) => {
  const core = Object.keys(CORE_TO_INFRA).find(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )

  document.querySelectorAll(`[${ACTIVE_ATTR}]`).forEach((el) => {
    el.removeAttribute(ACTIVE_ATTR)
  })

  if (!core) {
    return
  }

  const infraHref = CORE_TO_INFRA[core]
  const target = document.querySelector(`nav a[href$="${infraHref}"]`)

  if (target) {
    target.setAttribute(ACTIVE_ATTR, "")
    return
  }

  // Children are not mounted while the group is collapsed: open it.
  const parent = document.querySelector('nav a[href$="/commerce-infra"]')
  const trigger = parent
    ?.closest("div.w-full")
    ?.parentElement?.querySelector<HTMLButtonElement>(
      'button[data-state="closed"]'
    )
  trigger?.click()
}

const HideCoreSidebarWidget = () => {
  const { pathname } = useLocation()

  useEffect(() => {
    if (document.getElementById(STYLE_ID)) {
      return
    }

    const style = document.createElement("style")
    style.id = STYLE_ID
    style.textContent = buildCss()
    document.head.appendChild(style)
  }, [])

  useEffect(() => {
    // The sidebar re-renders (and may collapse) after navigation, so retry.
    const timers = [50, 200, 500, 1000].map((delay) =>
      window.setTimeout(() => syncSidebar(pathname), delay)
    )

    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [pathname])

  return null
}

export const config = defineWidgetConfig({
  zone: "topbar",
})

export default HideCoreSidebarWidget
