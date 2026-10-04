"use client"

import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react"
import { clx } from "@medusajs/ui"
import { usePathname } from "next/navigation"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { ChevronDownIcon, MenuIcon } from "@modules/common/icons/ui-icons"

export type NavCategory = {
  id: string
  name: string
  handle: string
  children: { id: string; name: string; handle: string }[]
}

export type NavVerticalLink = {
  label: string
  href: string
  testId: string
}

type CategoryNavProps = {
  categories: NavCategory[]
  /** Links to the other parts of the store (Eat, Book, Digital...). */
  verticals: NavVerticalLink[]
  /** How many top-level categories get their own link in the row. */
  visibleCount?: number
}

const linkClass =
  "whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm font-semibold text-muted transition-colors hover:text-ink"

/**
 * Second header row: an "All categories" panel (stores can have dozens of
 * top-level categories), the first few categories as links, and the other
 * sections of the store on the right.
 */
const CategoryNav = ({
  categories,
  verticals,
  visibleCount = 6,
}: CategoryNavProps) => {
  const pathname = usePathname() ?? ""
  const visible = categories.slice(0, visibleCount)

  const active = (href: string) =>
    pathname.split("/").slice(2).join("/").startsWith(href.replace(/^\//, ""))

  return (
    <nav
      aria-label="Categories"
      className="flex items-center gap-1 border-t border-line"
      data-testid="category-nav"
    >
      <Popover>
        {({ close }) => (
          <>
            <PopoverButton
              data-testid="nav-all-categories-button"
              className="flex items-center gap-2 whitespace-nowrap rounded-rounded px-3 py-2 text-sm font-bold text-ink hover:bg-canvas focus:outline-none"
            >
              <MenuIcon size={18} />
              All categories
              <ChevronDownIcon size={14} />
            </PopoverButton>
            <PopoverPanel
              className="absolute inset-x-0 top-full z-[70] max-h-[70vh] overflow-y-auto border-b border-line bg-card shadow-pop"
              data-testid="nav-all-categories-panel"
            >
              <div className="content-container grid grid-cols-2 gap-x-8 gap-y-6 py-6 small:grid-cols-4 medium:grid-cols-5">
                {categories.map((category) => (
                  <div key={category.id} className="min-w-0">
                    <LocalizedClientLink
                      href={`/categories/${category.handle}`}
                      onClick={close}
                      className="block truncate text-sm font-bold text-ink hover:text-brand"
                      data-testid="nav-category-link"
                    >
                      {category.name}
                    </LocalizedClientLink>
                    <ul className="mt-1.5 grid gap-1">
                      {category.children.slice(0, 4).map((child) => (
                        <li key={child.id} className="min-w-0">
                          <LocalizedClientLink
                            href={`/categories/${child.handle}`}
                            onClick={close}
                            className="block truncate text-sm text-muted hover:text-ink"
                          >
                            {child.name}
                          </LocalizedClientLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </PopoverPanel>
          </>
        )}
      </Popover>

      <div className="no-scrollbar flex min-w-0 flex-1 items-center overflow-x-auto">
        <LocalizedClientLink
          href="/store"
          data-testid="nav-store-catalog-link"
          className={clx(linkClass, {
            "!border-brand !text-brand": active("/store"),
          })}
        >
          Store
        </LocalizedClientLink>
        {visible.map((category) => {
          const href = `/categories/${category.handle}`
          return (
            <LocalizedClientLink
              key={category.id}
              href={href}
              data-testid={`nav-category-${category.handle}`}
              className={clx(linkClass, {
                "!border-brand !text-brand": active(href),
              })}
            >
              {category.name}
            </LocalizedClientLink>
          )
        })}
      </div>

      <div className="hidden shrink-0 items-center small:flex">
        {verticals.map((item) => (
          <LocalizedClientLink
            key={item.href}
            href={item.href}
            data-testid={item.testId}
            className={clx(linkClass, {
              "!border-brand !text-brand": active(item.href),
            })}
          >
            {item.label}
          </LocalizedClientLink>
        ))}
      </div>
    </nav>
  )
}

export default CategoryNav
