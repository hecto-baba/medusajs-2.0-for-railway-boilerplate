import { listCategories } from "@lib/data/categories"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { clx } from "@medusajs/ui"

/**
 * Category list for the left of the listing pages. Stores can have dozens of
 * top-level categories, so the list scrolls inside its own box. On a category
 * page it shows that category's sub-categories (or its siblings when it has
 * none), so one click moves sideways through the catalogue.
 */
export default async function CategorySidebar({
  currentHandle,
}: {
  currentHandle?: string
}) {
  const categories = (await listCategories().catch(() => [])) ?? []
  const current = categories.find((c) => c.handle === currentHandle)

  let heading = "Categories"
  let list = categories.filter((c) => !c.parent_category_id)

  if (current) {
    const children = categories.filter((c) => c.parent_category_id === current.id)
    if (children.length) {
      heading = current.name
      list = children
    } else if (current.parent_category_id) {
      const parent = categories.find((c) => c.id === current.parent_category_id)
      heading = parent?.name ?? "Categories"
      list = categories.filter(
        (c) => c.parent_category_id === current.parent_category_id
      )
    }
  }

  if (!list.length) {
    return null
  }

  return (
    <nav
      aria-label={heading}
      className="rounded-large bg-card p-2 shadow-lift"
      data-testid="category-sidebar"
    >
      <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wider text-muted">
        {heading}
      </p>
      <ul className="max-h-[70vh] overflow-y-auto">
        <li>
          <LocalizedClientLink
            href="/store"
            className={clx(
              "block rounded-rounded px-3 py-2 text-sm font-semibold hover:bg-canvas",
              !currentHandle && "bg-brand-soft text-brand"
            )}
          >
            All products
          </LocalizedClientLink>
        </li>
        {list.map((c) => (
          <li key={c.id}>
            <LocalizedClientLink
              href={`/categories/${c.handle}`}
              className={clx(
                "block truncate rounded-rounded px-3 py-2 text-sm font-semibold hover:bg-canvas",
                c.handle === currentHandle && "bg-brand-soft text-brand"
              )}
              aria-current={c.handle === currentHandle ? "page" : undefined}
            >
              {c.name}
            </LocalizedClientLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
