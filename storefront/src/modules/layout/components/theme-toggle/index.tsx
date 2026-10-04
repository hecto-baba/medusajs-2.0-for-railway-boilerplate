"use client"

import { useEffect, useState } from "react"

const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
)

const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
)

/**
 * Switches between light and dark and remembers the choice. The inline script
 * in the root layout applies the saved choice before first paint; this only
 * flips it afterwards.
 */
const ThemeToggle = () => {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"))
  }, [])

  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle("dark", next)
    document.documentElement.dataset.mode = next ? "dark" : "light"
    try {
      localStorage.setItem("theme", next ? "dark" : "light")
    } catch {
      // Private mode or blocked storage: the choice still applies to this visit.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      data-testid="theme-toggle"
      className="inline-flex items-center gap-2 rounded-circle border border-line bg-card px-3.5 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-muted"
    >
      {dark ? <SunIcon /> : <MoonIcon />}
      {dark ? "Light mode" : "Dark mode"}
    </button>
  )
}

export default ThemeToggle
