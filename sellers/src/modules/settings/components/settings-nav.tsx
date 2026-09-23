"use client"

import { Text } from "@medusajs/ui"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutComposer,
  CUSTOMIZE_IDS,
  CORE_LAYOUT_IDS,
} from "../../layout/layout-composer"

const SECTIONS = [
  {
    heading: "General",
    items: [
      { href: "/settings", label: "Store details" },
      { href: "/settings/team", label: "Team & Users" },
      { href: "/settings/regions", label: "Regions & Currencies" },
      { href: "/settings/sales-channels", label: "Sales Channels" },
      { href: "/settings/return-reasons", label: "Return Reasons" },
      { href: "/settings/refund-reasons", label: "Refund Reasons" },
    ],
  },
  {
    heading: "Product Organization",
    items: [
      { href: "/settings/product-types", label: "Product Types" },
      { href: "/settings/product-tags", label: "Product Tags" },
    ],
  },
  {
    heading: "Fulfillment",
    items: [
      { href: "/settings/locations", label: "Locations & Shipping" },
    ],
  },
  {
    heading: "Developer",
    items: [
      { href: "/settings/api-keys", label: "API Key Management" },
      { href: "/settings/workflows", label: "Workflows" },
    ],
  },
  {
    heading: "My Account",
    items: [
      { href: "/settings/profile", label: "Profile & Security" },
    ],
  },
]

export const SettingsNav = () => {
  const pathname = usePathname()

  return (
    <aside className="border-ui-border-base w-[220px] shrink-0 border-r p-3 overflow-y-auto">
      <LayoutComposer
        widgetsZonePrefix="settings-sidebar"
        preferredLayoutId={CORE_LAYOUT_IDS.SINGLE_COLUMN}
        customizeId={CUSTOMIZE_IDS.SETTINGS_SIDEBAR}
        controlSize="small"
        sections={{
          main: (
            <>
              {SECTIONS.map((section) => (
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
                      const isActive =
                        item.href === "/settings"
                          ? pathname === item.href
                          : pathname.startsWith(item.href)

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center rounded-md px-2 py-1.5 transition-fg ${
                            isActive
                              ? "bg-ui-bg-base shadow-elevation-card-rest text-ui-fg-base"
                              : "text-ui-fg-subtle hover:bg-ui-bg-base-hover"
                          }`}
                        >
                          <Text
                            size="small"
                            weight={isActive ? "plus" : "regular"}
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
    </aside>
  )
}
