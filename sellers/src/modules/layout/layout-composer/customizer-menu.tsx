"use client"

import { Adjustments, AdjustmentsDone } from "@medusajs/icons"
import { DropdownMenu, IconButton, Tooltip } from "@medusajs/ui"
import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect } from "react"
import { CUSTOMIZE_IDS } from "./constants"
import {
  useLayoutCustomizerActiveEditor,
  useLayoutEditRequest,
} from "./customizer-host-provider"
import { useHasLayoutCustomizations } from "./use-layout-preference"

type CustomizeHost = {
  id: string
  label: string
  navigateTo?: string
  isMounted: (pathname: string) => boolean
}

const isSettingsPath = (pathname: string): boolean =>
  pathname === "/settings" || pathname.startsWith("/settings/")

const HOSTS: CustomizeHost[] = [
  {
    id: CUSTOMIZE_IDS.PAGE,
    label: "Customize Page",
    isMounted: () => true,
  },
  {
    id: CUSTOMIZE_IDS.MAIN_SIDEBAR,
    label: "Customize Sidebar",
    navigateTo: "/orders",
    isMounted: (pathname) => !isSettingsPath(pathname),
  },
  {
    id: CUSTOMIZE_IDS.SETTINGS_SIDEBAR,
    label: "Customize Settings Sidebar",
    navigateTo: "/settings",
    isMounted: isSettingsPath,
  },
  {
    id: CUSTOMIZE_IDS.TOPBAR,
    label: "Customize Topbar",
    isMounted: () => true,
  },
]

export const CustomizerMenu = () => {
  const router = useRouter()
  const pathname = usePathname()
  const { activeEditor } = useLayoutCustomizerActiveEditor()
  const { requestEdit } = useLayoutEditRequest()
  const { has_customizations } = useHasLayoutCustomizations()

  const onSelect = useCallback(
    (host: CustomizeHost) => {
      if (host.isMounted(pathname)) {
        requestEdit(host.id)
        return
      }
      if (host.navigateTo) {
        router.push(host.navigateTo)
        setTimeout(() => {
          requestEdit(host.id)
        }, 150)
      }
    },
    [pathname, router, requestEdit]
  )

  // A composer is editing; its controls occupy the slot in place of this menu.
  if (activeEditor) {
    return null
  }

  return (
    <DropdownMenu>
      <Tooltip content="Customize layout">
        <DropdownMenu.Trigger asChild>
          <IconButton
            size="small"
            variant="transparent"
            aria-label="Customize layout"
            className="text-ui-fg-muted hover:text-ui-fg-subtle"
          >
            {has_customizations ? <AdjustmentsDone /> : <Adjustments />}
          </IconButton>
        </DropdownMenu.Trigger>
      </Tooltip>
      <DropdownMenu.Content align="end">
        {HOSTS.map((host) => (
          <DropdownMenu.Item key={host.id} onClick={() => onSelect(host)}>
            {host.label}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  )
}
