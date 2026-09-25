"use client"

import { vendorLogout } from "@lib/data/vendor"
import {
  BookOpen,
  CircleHalfSolid,
  EllipsisHorizontal,
  Keyboard,
  OpenRectArrowOut,
  TimelineVertical,
  User as UserIcon,
  XMark,
} from "@medusajs/icons"
import {
  Avatar,
  DropdownMenu,
  Heading,
  IconButton,
  Input,
  Kbd,
  Text,
} from "@medusajs/ui"
import { Dialog as RadixDialog } from "radix-ui"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useGlobalShortcuts } from "../search/use-keybind"

const THEME_KEY = "medusa_theme"

type ThemeOption = "system" | "light" | "dark"

const applyTheme = (opt: ThemeOption) => {
  if (typeof window === "undefined") return
  const isDark =
    opt === "dark" ||
    (opt === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  const html = document.documentElement
  if (isDark) {
    html.classList.add("dark")
    html.classList.remove("light")
    html.style.colorScheme = "dark"
  } else {
    html.classList.add("light")
    html.classList.remove("dark")
    html.style.colorScheme = "light"
  }
}

type UserMenuProps = {
  name: string | null
  email: string
}

export const UserMenu = ({ name, email }: UserMenuProps) => {
  const displayName = name || email
  const fallback = displayName.charAt(0).toUpperCase()

  const [openModal, setOpenModal] = useState(false)
  const [theme, setThemeState] = useState<ThemeOption>("system")

  useEffect(() => {
    try {
      const saved = (localStorage.getItem(THEME_KEY) as ThemeOption) || "system"
      setThemeState(saved)
      applyTheme(saved)
    } catch {
      // ignore
    }
  }, [])

  const setTheme = (newTheme: ThemeOption) => {
    try {
      localStorage.setItem(THEME_KEY, newTheme)
    } catch {
      // ignore
    }
    setThemeState(newTheme)
    applyTheme(newTheme)
  }

  return (
    <>
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
              Profile Settings
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Separator />

          <DropdownMenu.Item asChild>
            <a
              href="https://docs.medusajs.com"
              target="_blank"
              rel="noreferrer"
            >
              <BookOpen className="text-ui-fg-subtle me-2" />
              Documentation
            </a>
          </DropdownMenu.Item>

          <DropdownMenu.Item asChild>
            <a
              href="https://medusajs.com/changelog/"
              target="_blank"
              rel="noreferrer"
            >
              <TimelineVertical className="text-ui-fg-subtle me-2" />
              Change Log
            </a>
          </DropdownMenu.Item>

          <DropdownMenu.Separator />

          <DropdownMenu.Item
            onClick={() => setOpenModal(true)}
            className="cursor-pointer"
          >
            <Keyboard className="text-ui-fg-subtle me-2" />
            Shortcuts
          </DropdownMenu.Item>

          <DropdownMenu.SubMenu>
            <DropdownMenu.SubMenuTrigger className="rounded-md">
              <CircleHalfSolid className="text-ui-fg-subtle me-2" />
              <span>Theme</span>
            </DropdownMenu.SubMenuTrigger>
            <DropdownMenu.SubMenuContent>
              <DropdownMenu.RadioGroup value={theme}>
                <DropdownMenu.RadioItem
                  value="system"
                  onClick={(e) => {
                    e.preventDefault()
                    setTheme("system")
                  }}
                >
                  System
                </DropdownMenu.RadioItem>
                <DropdownMenu.RadioItem
                  value="light"
                  onClick={(e) => {
                    e.preventDefault()
                    setTheme("light")
                  }}
                >
                  Light
                </DropdownMenu.RadioItem>
                <DropdownMenu.RadioItem
                  value="dark"
                  onClick={(e) => {
                    e.preventDefault()
                    setTheme("dark")
                  }}
                >
                  Dark
                </DropdownMenu.RadioItem>
              </DropdownMenu.RadioGroup>
            </DropdownMenu.SubMenuContent>
          </DropdownMenu.SubMenu>

          <DropdownMenu.Separator />

          <form action={vendorLogout} className="w-full">
            <button type="submit" className="w-full text-start">
              <DropdownMenu.Item className="cursor-pointer">
                <OpenRectArrowOut className="text-ui-fg-subtle me-2" />
                Logout
              </DropdownMenu.Item>
            </button>
          </form>
        </DropdownMenu.Content>
      </DropdownMenu>

      <GlobalKeybindsModal open={openModal} onOpenChange={setOpenModal} />
    </>
  )
}

const GlobalKeybindsModal = ({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) => {
  const globalShortcuts = useGlobalShortcuts()
  const [searchValue, setSearchValue] = useState("")

  const searchResults = searchValue
    ? globalShortcuts.filter((shortcut) =>
        shortcut.label.toLowerCase().includes(searchValue.toLowerCase())
      )
    : globalShortcuts

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="bg-ui-bg-overlay fixed inset-0 z-50 backdrop-blur-sm" />
        <RadixDialog.Content className="bg-ui-bg-subtle shadow-elevation-modal fixed left-[50%] top-[50%] z-50 flex h-full max-h-[612px] w-full max-w-[560px] translate-x-[-50%] translate-y-[-50%] flex-col divide-y overflow-hidden rounded-lg outline-none">
          <div className="flex flex-col gap-y-3 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <RadixDialog.Title asChild>
                  <Heading level="h2">Shortcuts</Heading>
                </RadixDialog.Title>
                <RadixDialog.Description className="sr-only">
                  Overview of keyboard shortcuts
                </RadixDialog.Description>
              </div>
              <div className="flex items-center gap-x-2">
                <Kbd>esc</Kbd>
                <RadixDialog.Close asChild>
                  <IconButton variant="transparent" size="small">
                    <XMark />
                  </IconButton>
                </RadixDialog.Close>
              </div>
            </div>
            <div>
              <Input
                type="search"
                placeholder="Search shortcuts..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col divide-y overflow-y-auto">
            {searchResults.map((shortcut, index) => {
              return (
                <div
                  key={index}
                  className="text-ui-fg-subtle flex items-center justify-between px-6 py-3"
                >
                  <Text size="small">{shortcut.label}</Text>
                  <div className="flex items-center gap-x-1">
                    {shortcut.keys.Mac?.map((key, kIndex) => {
                      return (
                        <div className="flex items-center gap-x-1" key={kIndex}>
                          <Kbd>{key}</Kbd>
                          {kIndex < (shortcut.keys.Mac?.length || 0) - 1 && (
                            <span className="txt-compact-xsmall text-ui-fg-subtle">
                              then
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
