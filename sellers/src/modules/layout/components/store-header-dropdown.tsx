"use client"

import { vendorLogout } from "@lib/data/vendor"
import { BuildingStorefront, EllipsisHorizontal, OpenRectArrowOut } from "@medusajs/icons"
import { Avatar, DropdownMenu, Text, clx } from "@medusajs/ui"
import Link from "next/link"

type StoreHeaderDropdownProps = {
  storeName: string
  verticalLabel?: string | null
  vendorTypeLabel?: string | null
}

export const StoreHeaderDropdown = ({
  storeName,
  verticalLabel,
  vendorTypeLabel,
}: StoreHeaderDropdownProps) => {
  const fallback = storeName ? storeName.charAt(0).toUpperCase() : "S"

  return (
    <div className="w-full">
      <DropdownMenu>
        <DropdownMenu.Trigger
          className={clx(
            "bg-ui-bg-subtle transition-fg grid w-full grid-cols-[28px_1fr_16px] items-center gap-x-2.5 rounded-md p-1.5 outline-none text-start",
            "hover:bg-ui-bg-subtle-hover",
            "data-[state=open]:bg-ui-bg-subtle-hover",
            "focus-visible:shadow-borders-focus"
          )}
        >
          <Avatar variant="squared" size="small" fallback={fallback} />
          <div className="flex flex-col min-w-0 overflow-hidden">
            <Text
              size="small"
              weight="plus"
              leading="compact"
              className="text-ui-fg-base truncate"
            >
              {storeName}
            </Text>
            {verticalLabel ? (
              <Text
                size="xsmall"
                leading="compact"
                className="text-ui-fg-subtle truncate"
              >
                {verticalLabel} {vendorTypeLabel ? `• ${vendorTypeLabel}` : ""}
              </Text>
            ) : (
              <Text
                size="xsmall"
                leading="compact"
                className="text-ui-fg-subtle"
              >
                Store
              </Text>
            )}
          </div>
          <EllipsisHorizontal className="text-ui-fg-muted" />
        </DropdownMenu.Trigger>

        <DropdownMenu.Content className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[200px]">
          <div className="flex items-center gap-x-3 px-2 py-1.5">
            <Avatar variant="squared" size="small" fallback={fallback} />
            <div className="flex flex-col overflow-hidden min-w-0">
              <Text
                size="small"
                weight="plus"
                leading="compact"
                className="text-ui-fg-base truncate"
              >
                {storeName}
              </Text>
              <Text
                size="xsmall"
                leading="compact"
                className="text-ui-fg-subtle"
              >
                Store
              </Text>
            </div>
          </div>

          <DropdownMenu.Separator />

          <DropdownMenu.Item className="cursor-pointer" asChild>
            <Link href="/settings" className="flex items-center gap-x-2">
              <BuildingStorefront className="text-ui-fg-subtle" />
              Store Settings
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Separator />

          <form action={vendorLogout} className="w-full">
            <button type="submit" className="w-full text-start">
              <DropdownMenu.Item className="cursor-pointer flex items-center gap-x-2">
                <OpenRectArrowOut className="text-ui-fg-subtle" />
                Logout
              </DropdownMenu.Item>
            </button>
          </form>
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  )
}
