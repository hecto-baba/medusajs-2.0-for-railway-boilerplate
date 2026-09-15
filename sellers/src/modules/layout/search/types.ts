import { SEARCH_AREAS } from "./constants"

export type SearchArea = (typeof SEARCH_AREAS)[number]

export type DynamicSearchResultItem = {
  id: string
  title: string
  subtitle?: string
  to: string
  thumbnail?: string
  value: string
}

export type DynamicSearchResult = {
  area: SearchArea
  title: string
  hasMore: boolean
  count: number
  items: DynamicSearchResultItem[]
}

export type ShortcutType = "pageShortcut" | "settingShortcut" | "commandShortcut"

export type Shortcut = {
  label: string
  type: ShortcutType
  to?: string
  callback?: () => void
  keys: {
    Mac?: string[]
    Windows?: string[]
  }
}

export type StaticSearchResult = {
  title: ShortcutType
  heading: string
  items: Shortcut[]
}
