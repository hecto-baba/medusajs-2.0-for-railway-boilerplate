"use client"

import i18n from "i18next"
import { useEffect, useState } from "react"
import { I18nextProvider, initReactI18next } from "react-i18next"
import en from "./en.json"

/**
 * i18next setup for the vendor panel, mirroring the admin's config.ts:
 * cookie/localStorage-backed language choice, English fallback, no HTML
 * escaping (React already escapes).
 *
 * Initialised once at module scope rather than per-render - i18next.init is
 * not idempotent-safe to call from a component body, and the whole point of a
 * singleton client is that every consumer shares the same instance.
 */
let initialised = false

const getInitialLanguage = () => {
  if (typeof window === "undefined") {
    return "en"
  }

  try {
    return window.localStorage.getItem("lng") || "en"
  } catch {
    return "en"
  }
}

const ensureInitialised = () => {
  if (initialised) {
    return
  }

  i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: getInitialLanguage(),
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  })

  initialised = true
}

ensureInitialised()

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  // Forces one client re-render after mount so a language restored from
  // localStorage (unavailable during the server render) takes effect instead
  // of staying on the "en" the server had to guess.
  const [, setReady] = useState(false)

  useEffect(() => {
    setReady(true)
  }, [])

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}
