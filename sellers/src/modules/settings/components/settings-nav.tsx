"use client"

import { Text } from "@medusajs/ui"
import Link from "next/link"
import { usePathname } from "next/navigation"

const SECTIONS = [
  {
    heading: "General",
    items: [
      { href: "/settings", label: "Store details" },
      { href: "/settings/return-reasons", label: "Return Reasons" },
      { href: "/settings/refund-reasons", label: "Refund Reasons" },
    ],
  },
  {
    heading: "My Account",
    items: [{ href: "/settings/profile", label: "Profile" }],
  },
]

/**
 * Secondary nav shown alongside every settings page.
 *
 * Store details sits at /settings itself, where a prefix match would also
 * light up every other section (they all start with "/settings"), so it is
 * matched by equality; every other item is matched by prefix, so a create or
 * edit sub-route (e.g. /settings/return-reasons/create) still highlights its
 * parent.
 */
export const SettingsNav = () => {
  const pathname = usePathname()

  return (
    <aside className="border-ui-border-base w-[220px] shrink-0 border-r p-3">
      <div className="flex flex-col gap-y-4">
        {SECTIONS.map((section) => (
          <div key={section.heading} className="flex flex-col gap-y-1">
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
                  <Text size="small" weight={isActive ? "plus" : "regular"}>
                    {item.label}
                  </Text>
                </Link>
              )
            })}
          </div>
        ))}
      </div>
    </aside>
  )
}
