"use client"

import { vendorLogout } from "@lib/data/vendor"
import {
  BuildingStorefront,
  CurrencyDollar,
  ReceiptPercent,
  ShoppingCart,
  Tag,
} from "@medusajs/icons"
import { Avatar, Text } from "@medusajs/ui"
import Link from "next/link"
import { usePathname } from "next/navigation"

const NAV_ITEMS = [
  { href: "/orders", label: "Orders", icon: ShoppingCart },
  { href: "/products", label: "Products", icon: Tag },
]

// Listed but not linked: these need a vendor-scoped backend route before they
// can show anything, so they read as "coming" rather than as broken links.
const UPCOMING_ITEMS = [
  { label: "Inventory", icon: BuildingStorefront },
  { label: "Promotions", icon: ReceiptPercent },
  { label: "Price Lists", icon: CurrencyDollar },
]

type SidebarProps = {
  storeName: string
  email: string
}

export const Sidebar = ({ storeName, email }: SidebarProps) => {
  const pathname = usePathname()

  return (
    <aside className="bg-ui-bg-subtle border-ui-border-base flex h-screen w-[220px] shrink-0 flex-col justify-between border-r">
      <div className="flex flex-col gap-y-4 p-3">
        <div className="flex items-center gap-x-2 px-2 py-1">
          <Avatar fallback={storeName.charAt(0).toUpperCase()} size="small" />
          <Text size="small" weight="plus" className="text-ui-fg-base truncate">
            {storeName}
          </Text>
        </div>

        <nav className="flex flex-col gap-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-x-2 rounded-md px-2 py-1.5 transition-fg ${
                  isActive
                    ? "bg-ui-bg-base shadow-elevation-card-rest text-ui-fg-base"
                    : "text-ui-fg-subtle hover:bg-ui-bg-base-hover"
                }`}
              >
                <Icon />
                <Text size="small" weight={isActive ? "plus" : "regular"}>
                  {item.label}
                </Text>
              </Link>
            )
          })}

          {UPCOMING_ITEMS.map((item) => {
            const Icon = item.icon

            return (
              <div
                key={item.label}
                className="text-ui-fg-disabled flex cursor-not-allowed items-center gap-x-2 rounded-md px-2 py-1.5"
                title="Not available yet"
              >
                <Icon />
                <Text size="small">{item.label}</Text>
              </div>
            )
          })}
        </nav>
      </div>

      <div className="border-ui-border-base flex flex-col gap-y-2 border-t p-3">
        <Text size="xsmall" className="text-ui-fg-muted truncate px-2">
          {email}
        </Text>
        <form action={vendorLogout} className="px-2">
          <button
            type="submit"
            className="text-ui-fg-subtle hover:text-ui-fg-base txt-compact-small"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  )
}
