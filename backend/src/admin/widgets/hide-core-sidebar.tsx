import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect } from "react"

// Core sidebar entries that are grouped under "Commerce Infra" instead.
// Pages stay reachable; only the sidebar links are hidden.
const HIDDEN_PATHS = [
  "/orders",
  "/products",
  "/inventory",
  "/customers",
  "/promotions",
  "/price-lists",
]

const STYLE_ID = "hide-core-sidebar-style"

const HideCoreSidebarWidget = () => {
  useEffect(() => {
    if (document.getElementById(STYLE_ID)) {
      return
    }

    // Exact match, with or without the /app basename, so the Commerce Infra
    // children (e.g. /commerce-infra/orders) are never hidden.
    const selectors = HIDDEN_PATHS.flatMap((path) => [
      `nav div:has(> a[href="${path}"])`,
      `nav div:has(> a[href="/app${path}"])`,
    ])

    const style = document.createElement("style")
    style.id = STYLE_ID
    style.textContent = `${selectors.join(",\n")} { display: none !important; }`
    document.head.appendChild(style)
  }, [])

  return null
}

export const config = defineWidgetConfig({
  zone: "topbar",
})

export default HideCoreSidebarWidget
