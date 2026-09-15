"use client"

import { createContext } from "react"

export type SearchContextValue = {
  open: boolean
  onOpenChange: (open: boolean) => void
  toggleSearch: () => void
}

export const SearchContext = createContext<SearchContextValue | null>(null)
