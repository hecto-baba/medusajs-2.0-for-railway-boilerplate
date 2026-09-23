"use client"

import { PropsWithChildren, useEffect, useState } from "react"
import { Search } from "./search"
import { SearchContext } from "./search-context"
import { useGlobalShortcuts, useKeySequenceListener } from "./use-keybind"

export const SearchProvider = ({ children }: PropsWithChildren) => {
  const [open, setOpen] = useState(false)
  const shortcuts = useGlobalShortcuts()

  const toggleSearch = () => {
    setOpen((prev) => !prev)
  }

  // Global ⌘K / Ctrl+K listener
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    document.addEventListener("keydown", onKeyDown)

    return () => {
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [])

  // Listen for key sequences like "G then O" when search dialog is closed
  useKeySequenceListener(shortcuts, !open)

  return (
    <SearchContext.Provider
      value={{
        open,
        onOpenChange: setOpen,
        toggleSearch,
      }}
    >
      {children}
      <Search />
    </SearchContext.Provider>
  )
}
