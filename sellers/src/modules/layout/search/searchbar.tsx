"use client"

import { MagnifyingGlass } from "@medusajs/icons"
import { clx, Text } from "@medusajs/ui"
import { useSearch } from "./use-search"

export const Searchbar = () => {
  const { toggleSearch } = useSearch()

  return (
    <div>
      <button
        type="button"
        onClick={toggleSearch}
        className={clx(
          "bg-ui-bg-subtle text-ui-fg-subtle flex w-full items-center gap-x-2.5 rounded-md px-2 py-1 outline-none transition-fg",
          "hover:bg-ui-bg-subtle-hover",
          "focus-visible:shadow-borders-focus cursor-pointer"
        )}
      >
        <MagnifyingGlass />
        <div className="flex-1 text-start">
          <Text size="small" leading="compact" weight="plus">
            Search
          </Text>
        </div>
        <Text size="small" leading="compact" className="text-ui-fg-muted">
          ⌘K
        </Text>
      </button>
    </div>
  )
}
