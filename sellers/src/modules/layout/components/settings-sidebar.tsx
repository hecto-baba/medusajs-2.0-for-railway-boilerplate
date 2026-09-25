"use client"

import { ArrowUturnLeft } from "@medusajs/icons"
import { clx, Text } from "@medusajs/ui"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserMenu } from "./user-menu"
import {
  LayoutComposer,
  CUSTOMIZE_IDS,
  CORE_LAYOUT_IDS,
} from "../layout-composer"

type SettingsSidebarProps = {
  email: string
  name: string | null
}

const SETTINGS_SECTIONS = [
  {
    heading: "General",
    items: [
      { href: "/settings", label: "Store" },
      { href: "/settings/team", label: "Users" },
      { href: "/settings/regions", label: "Regions" },
      { href: "/settings/tax-regions", label: "Tax Regions" },
      { href: "/settings/return-reasons", label: "Return Reasons" },
      { href: "/settings/refund-reasons", label: "Refund Reasons" },
      { href: "/settings/sales-channels", label: "Sales Channels" },
      { href: "/settings/product-types", label: "Product Types" },
      { href: "/settings/product-tags", label: "Product Tags" },
      { href: "/settings/locations", label: "Locations" },
    ],
  },
  {
    heading: "Developer",
    items: [
      { href: "/settings/publishable-api-keys", label: "Publishable API Keys" },
      { href: "/settings/secret-api-keys", label: "Secret API Keys" },
      { href: "/settings/workflows", label: "Workflows" },
    ],
  },
  {
    heading: "My Account",
    items: [
      { href: "/settings/profile", label: "Profile" },
    ],
  },
]

export const SettingsSidebar = ({ email, name }: SettingsSidebarProps) => {
  const pathname = usePathname()

  const checkActive = (href: string) => {
    if (href === "/settings") {
      return (
        pathname === "/settings" ||
        pathname === "/settings/store" ||
        pathname === "/settings/edit"
      )
    }

    if (href === "/settings/team") {
      return (
        pathname === "/settings/team" ||
        pathname === "/settings/users" ||
        pathname.startsWith("/settings/team/") ||
        pathname.startsWith("/settings/users/")
      )
    }

    if (href === "/settings/publishable-api-keys") {
      return (
        pathname === "/settings/publishable-api-keys" ||
        pathname.startsWith("/settings/publishable-api-keys/")
      )
    }

    if (href === "/settings/secret-api-keys") {
      return (
        pathname === "/settings/secret-api-keys" ||
        pathname.startsWith("/settings/secret-api-keys/")
      )
    }

    if (href.startsWith("/settings/api-keys")) {
      return (
        pathname.startsWith("/settings/api-keys") ||
        pathname.startsWith("/settings/publishable-api-keys") ||
        pathname.startsWith("/settings/secret-api-keys")
      )
    }

    if (href === "/settings/workflows") {
      return (
        pathname === "/settings/workflows" ||
        pathname.startsWith("/settings/workflows/")
      )
    }

    const cleanHref = href.split("?")[0]
    return pathname === cleanHref || pathname.startsWith(cleanHref + "/")
  }

  return (
    <aside className="bg-ui-bg-subtle border-ui-border-base flex h-screen w-[220px] shrink-0 flex-col justify-between border-r">
      <div className="flex flex-col overflow-y-auto">
        {/* Sticky Header with Back Button to Orders */}
        <div className="bg-ui-bg-subtle sticky top-0 z-10 p-3">
          <Link
            href="/orders"
            className={clx(
              "bg-ui-bg-subtle transition-fg flex items-center rounded-md outline-none",
              "hover:bg-ui-bg-subtle-hover",
              "focus-visible:shadow-borders-focus"
            )}
          >
            <div className="flex items-center gap-x-2.5 px-2 py-1">
              <div className="flex items-center justify-center">
                <ArrowUturnLeft className="text-ui-fg-subtle" />
              </div>
              <Text leading="compact" weight="plus" size="small">
                Settings
              </Text>
            </div>
          </Link>
        </div>

        <div className="px-3">
          <div className="border-ui-border-base border-t border-dashed" />
        </div>

        <nav className="flex flex-col p-3">
          <LayoutComposer
            widgetsZonePrefix="settings.sidebar"
            preferredLayoutId={CORE_LAYOUT_IDS.SETTINGS_SIDEBAR}
            customizeId={CUSTOMIZE_IDS.SETTINGS_SIDEBAR}
            controlSize="small"
            sections={{
              main: (
                <>
                  {SETTINGS_SECTIONS.map((section) => (
                    <LayoutComposer.Entry
                      id={`settings-sec:${section.heading}`}
                      key={section.heading}
                    >
                      <div className="flex flex-col gap-y-1 mb-3">
                        <Text
                          size="xsmall"
                          weight="plus"
                          className="text-ui-fg-muted px-2 py-1"
                        >
                          {section.heading}
                        </Text>

                        {section.items.map((item) => {
                          const isActive = checkActive(item.href)

                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={clx(
                                "text-ui-fg-subtle transition-fg hover:bg-ui-bg-subtle-hover flex items-center rounded-md px-2 py-1 outline-none focus-visible:shadow-borders-focus",
                                {
                                  "bg-ui-bg-base shadow-elevation-card-rest text-ui-fg-base hover:bg-ui-bg-base font-medium":
                                    isActive,
                                }
                              )}
                            >
                              <Text
                                size="small"
                                weight={isActive ? "plus" : "regular"}
                                leading="compact"
                              >
                                {item.label}
                              </Text>
                            </Link>
                          )
                        })}
                      </div>
                    </LayoutComposer.Entry>
                  ))}
                </>
              ),
            }}
          />
        </nav>
      </div>

      {/* User menu section at bottom */}
      <div className="flex flex-col gap-y-2 p-3">
        <div className="border-ui-border-strong border-t border-dashed" />
        <UserMenu name={name} email={email} />
      </div>
    </aside>
  )
}
