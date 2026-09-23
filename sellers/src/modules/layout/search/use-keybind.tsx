"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { vendorLogout } from "@lib/data/vendor"
import { Shortcut } from "./types"

export const useGlobalShortcuts = (): Shortcut[] => {
  const router = useRouter()

  const handleLogout = useCallback(async () => {
    await vendorLogout()
  }, [])

  const globalShortcuts: Shortcut[] = useMemo(
    () => [
      // Navigation / Pages
      {
        keys: { Mac: ["G", "O"] },
        label: "Orders",
        type: "pageShortcut",
        to: "/orders",
      },
      {
        keys: { Mac: ["G", "P"] },
        label: "Products",
        type: "pageShortcut",
        to: "/products",
      },
      {
        keys: { Mac: ["G", "C"] },
        label: "Collections",
        type: "pageShortcut",
        to: "/products/collections",
      },
      {
        keys: { Mac: ["G", "A"] },
        label: "Categories",
        type: "pageShortcut",
        to: "/products/categories",
      },
      {
        keys: { Mac: ["G", "T"] },
        label: "Product Options",
        type: "pageShortcut",
        to: "/products/options",
      },
      {
        keys: { Mac: ["G", "U"] },
        label: "Customers",
        type: "pageShortcut",
        to: "/customers",
      },
      {
        keys: { Mac: ["G", "G"] },
        label: "Customer Groups",
        type: "pageShortcut",
        to: "/customers/groups",
      },
      {
        keys: { Mac: ["G", "I"] },
        label: "Inventory",
        type: "pageShortcut",
        to: "/inventory",
      },
      {
        keys: { Mac: ["G", "R"] },
        label: "Reservations",
        type: "pageShortcut",
        to: "/reservations",
      },
      {
        keys: { Mac: ["G", "L"] },
        label: "Price Lists",
        type: "pageShortcut",
        to: "/pricing",
      },
      {
        keys: { Mac: ["G", "M"] },
        label: "Promotions",
        type: "pageShortcut",
        to: "/promotions",
      },
      {
        keys: { Mac: ["G", "K"] },
        label: "Campaigns",
        type: "pageShortcut",
        to: "/promotions/campaigns",
      },
      {
        keys: { Mac: ["G", "V"] },
        label: "Venues",
        type: "pageShortcut",
        to: "/venues",
      },
      {
        keys: { Mac: ["G", "S"] },
        label: "Shows",
        type: "pageShortcut",
        to: "/shows",
      },

      // Settings
      {
        keys: { Mac: ["G", ","] },
        label: "Settings",
        type: "settingShortcut",
        to: "/settings",
      },
      {
        keys: { Mac: ["G", ",", "M"] },
        label: "Profile",
        type: "settingShortcut",
        to: "/settings/profile",
      },
      {
        keys: { Mac: ["G", ",", "L"] },
        label: "Locations",
        type: "settingShortcut",
        to: "/settings/locations",
      },
      {
        keys: { Mac: ["G", ",", "R"] },
        label: "Return Reasons",
        type: "settingShortcut",
        to: "/settings/return-reasons",
      },
      {
        keys: { Mac: ["G", ",", "F"] },
        label: "Refund Reasons",
        type: "settingShortcut",
        to: "/settings/refund-reasons",
      },
      {
        keys: { Mac: ["G", ",", "W"] },
        label: "Workflows",
        type: "settingShortcut",
        to: "/settings/workflows",
      },

      // Commands
      {
        keys: { Mac: ["B", "Y", "E"] },
        label: "Log out",
        type: "commandShortcut",
        callback: handleLogout,
      },
    ],
    [handleLogout]
  )

  return globalShortcuts
}

export const useKeySequenceListener = (
  shortcuts: Shortcut[],
  enabled = true
) => {
  const router = useRouter()
  const [keys, setKeys] = useState<string[]>([])
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const clearKeys = useCallback(() => {
    setKeys([])
  }, [])

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true" ||
        target.closest('[role="dialog"]')
      ) {
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      const key = event.key.toUpperCase()

      setKeys((prev) => {
        const next = [...prev, key]

        // Check if any shortcut matches
        const match = shortcuts.find((s) => {
          const expected = s.keys.Mac?.map((k) => k.toUpperCase())
          if (!expected || expected.length !== next.length) return false
          return expected.every((k, idx) => k === next[idx])
        })

        if (match) {
          if (match.to) {
            router.push(match.to)
          } else if (match.callback) {
            match.callback()
          }
          return []
        }

        // Check if `next` is a prefix of any shortcut
        const isPrefix = shortcuts.some((s) => {
          const expected = s.keys.Mac?.map((k) => k.toUpperCase())
          if (!expected || expected.length < next.length) return false
          return next.every((k, idx) => k === expected[idx])
        })

        if (!isPrefix) {
          return [key]
        }

        return next
      })

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(clearKeys, 1000)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [shortcuts, enabled, router, clearKeys])
}
