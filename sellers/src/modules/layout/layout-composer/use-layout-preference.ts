"use client"

import { toast } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { LayoutPreference, LayoutScope } from "./types"

const EMPTY_PREFERENCE: LayoutPreference = { widgets: {} }
const STORAGE_PREFIX = "vendor_layout_pref_"

export type UseLayoutPreferenceReturn = {
  personalPreference: LayoutPreference
  defaultPreference: LayoutPreference
  activeScope: LayoutScope
  definedScope: LayoutScope | null
  setPreference: (
    next: LayoutPreference,
    options?: { asDefault?: boolean },
    onSuccess?: () => void
  ) => void
  resetPreference: (onSuccess?: () => void) => void
  isSaving: boolean
}

function getStoredPreference(zone: string): LayoutPreference | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${zone}`)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === "object" && parsed.widgets) {
        return parsed
      }
    }
  } catch {
    // ignore
  }
  return null
}

function saveStoredPreference(zone: string, pref: LayoutPreference | null) {
  if (typeof window === "undefined") return
  try {
    if (pref && Object.keys(pref.widgets).length > 0) {
      window.localStorage.setItem(
        `${STORAGE_PREFIX}${zone}`,
        JSON.stringify(pref)
      )
    } else {
      window.localStorage.removeItem(`${STORAGE_PREFIX}${zone}`)
    }
  } catch {
    // ignore
  }
}

export function useLayoutPreference(zone: string): UseLayoutPreferenceReturn {
  const [personalPreference, setPersonalPreference] =
    useState<LayoutPreference>(() => getStoredPreference(zone) ?? EMPTY_PREFERENCE)
  const [isSaving, setIsSaving] = useState(false)

  // Sync from localStorage / server on mount
  useEffect(() => {
    const local = getStoredPreference(zone)
    if (local) {
      setPersonalPreference(local)
    }

    // Try background fetch from server proxy
    let isMounted = true
    fetch(`/api/vendors/layouts/${encodeURIComponent(zone)}/configuration`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data) return
        const serverConfig =
          data.personal_configuration?.configuration ||
          data.default_configuration?.configuration
        if (serverConfig?.widgets) {
          setPersonalPreference({ widgets: serverConfig.widgets })
          saveStoredPreference(zone, { widgets: serverConfig.widgets })
        }
      })
      .catch(() => {
        // Fallback to local storage
      })

    return () => {
      isMounted = false
    }
  }, [zone])

  const defaultPreference = EMPTY_PREFERENCE
  const activeScope: LayoutScope = "personal"
  const definedScope: LayoutScope | null =
    Object.keys(personalPreference.widgets).length > 0 ? "personal" : null

  const setPreference = useCallback(
    (
      next: LayoutPreference,
      options?: { asDefault?: boolean },
      onSuccess?: () => void
    ) => {
      setIsSaving(true)
      setPersonalPreference(next)
      saveStoredPreference(zone, next)

      // Post to backend proxy
      fetch(`/api/vendors/layouts/${encodeURIComponent(zone)}/configuration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_default: options?.asDefault ?? false,
          configuration: { widgets: next.widgets },
        }),
      })
        .catch(() => {})
        .finally(() => {
          setIsSaving(false)
          toast.success("Layout preferences saved")
          onSuccess?.()
        })
    },
    [zone]
  )

  const resetPreference = useCallback(
    (onSuccess?: () => void) => {
      setIsSaving(true)
      setPersonalPreference(EMPTY_PREFERENCE)
      saveStoredPreference(zone, null)

      fetch(`/api/vendors/layouts/${encodeURIComponent(zone)}/configuration`, {
        method: "DELETE",
      })
        .catch(() => {})
        .finally(() => {
          setIsSaving(false)
          toast.success("Layout reset to default")
          onSuccess?.()
        })
    },
    [zone]
  )

  return {
    personalPreference,
    defaultPreference,
    activeScope,
    definedScope,
    setPreference,
    resetPreference,
    isSaving,
  }
}

export function useHasLayoutCustomizations(): { has_customizations: boolean } {
  const [hasCustomizations, setHasCustomizations] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      let found = false
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (key && key.startsWith(STORAGE_PREFIX)) {
          const val = window.localStorage.getItem(key)
          if (val && val !== '{"widgets":{}}') {
            found = true
            break
          }
        }
      }
      setHasCustomizations(found)
    } catch {
      // ignore
    }
  }, [])

  return { has_customizations: hasCustomizations }
}
