"use client"

import { vendorLogout } from "@lib/data/vendor"
import {
  CogSixTooth,
  EllipsisHorizontal,
  OpenRectArrowOut,
  User as UserIcon,
} from "@medusajs/icons"
import { Avatar, DropdownMenu, Text } from "@medusajs/ui"
import Link from "next/link"

type UserMenuProps = {
  name: string | null
  email: string
}

/**
 * The signed-in vendor's badge at the foot of the sidebar, opening a menu.
 *
 * Sign out stays a <form> posting to the logout server action rather than an
 * onClick: the action clears an httpOnly cookie, which client JavaScript
 * cannot reach.
 */
export const UserMenu = ({ name, email }: UserMenuProps) => {
  const displayName = name || email
  const fallback = displayName.charAt(0).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger className="bg-ui-bg-subtle hover:bg-ui-bg-subtle-hover data-[state=open]:bg-ui-bg-subtle-hover focus-visible:shadow-borders-focus grid w-full cursor-pointer grid-cols-[24px_1fr_15px] items-center gap-2 rounded-md py-1 pe-2 ps-0.5 outline-none">
        <div className="flex size-6 items-center justify-center">
          <Avatar size="xsmall" fallback={fallback} />
        </div>
        <div className="flex items-center overflow-hidden">
          <Text
            size="xsmall"
            weight="plus"
            leading="compact"
            className="truncate"
          >
            {displayName}
          </Text>
        </div>
        <EllipsisHorizontal className="text-ui-fg-muted" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Content className="min-w-[var(--radix-dropdown-menu-trigger-width)]">
        <div className="flex items-center gap-x-3 overflow-hidden px-2 py-1">
          <Avatar size="small" variant="rounded" fallback={fallback} />
          <div className="block w-full min-w-0 overflow-hidden">
            <Text
              size="small"
              weight="plus"
              leading="compact"
              className="truncate"
            >
              {displayName}
            </Text>
            {!!name && (
              <Text
                size="xsmall"
                leading="compact"
                className="text-ui-fg-subtle truncate"
              >
                {email}
              </Text>
            )}
          </div>
        </div>

        <DropdownMenu.Separator />

        <DropdownMenu.Item asChild>
          <Link href="/settings/profile">
            <UserIcon className="text-ui-fg-subtle me-2" />
            Profile settings
          </Link>
        </DropdownMenu.Item>

        <DropdownMenu.Item asChild>
          <Link href="/settings">
            <CogSixTooth className="text-ui-fg-subtle me-2" />
            Store settings
          </Link>
        </DropdownMenu.Item>

        <DropdownMenu.Separator />

        <form action={vendorLogout}>
          <button type="submit" className="w-full">
            <DropdownMenu.Item className="cursor-pointer">
              <OpenRectArrowOut className="text-ui-fg-subtle me-2" />
              Sign out
            </DropdownMenu.Item>
          </button>
        </form>
      </DropdownMenu.Content>
    </DropdownMenu>
  )
}
