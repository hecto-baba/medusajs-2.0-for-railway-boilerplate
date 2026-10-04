import { getCategoriesList } from "@lib/data/categories"
import { getCollectionsList } from "@lib/data/collections"
import { getStoreName } from "@lib/util/env"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import MedusaCTA from "@modules/layout/components/medusa-cta"
import ThemeToggle from "@modules/layout/components/theme-toggle"

const linkClass = "text-sm text-muted transition-colors hover:text-ink"

export default async function Footer() {
  const [{ collections }, { product_categories }] = await Promise.all([
    getCollectionsList(0, 6),
    getCategoriesList(0, 6),
  ])

  return (
    <footer className="mt-16 w-full border-t border-line bg-card text-ink">
      <div className="content-container flex w-full flex-col">
        <div className="grid gap-10 py-12 small:grid-cols-[1.4fr_2fr]">
          <div className="max-w-xs">
            <LocalizedClientLink
              href="/"
              className="flex items-center gap-1 font-display text-2xl font-extrabold tracking-tight text-brand"
            >
              {getStoreName()}
            </LocalizedClientLink>
            <p className="mt-3 text-sm text-muted">
              Shop, eat, book, rent and more from one place.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {product_categories && product_categories.length > 0 && (
              <div className="flex flex-col gap-y-3">
                <span className="text-sm font-bold">Categories</span>
                <ul className="grid gap-2" data-testid="footer-categories">
                  {product_categories.slice(0, 6).map((c) => {
                    if (c.parent_category) {
                      return null
                    }

                    const children =
                      c.category_children?.map((child) => ({
                        name: child.name,
                        handle: child.handle,
                        id: child.id,
                      })) || null

                    return (
                      <li key={c.id} className="flex flex-col gap-2">
                        <LocalizedClientLink
                          className={linkClass}
                          href={`/categories/${c.handle}`}
                          data-testid="category-link"
                        >
                          {c.name}
                        </LocalizedClientLink>
                        {children && (
                          <ul className="ml-3 grid gap-2">
                            {children.slice(0, 4).map((child) => (
                              <li key={child.id}>
                                <LocalizedClientLink
                                  className={linkClass}
                                  href={`/categories/${child.handle}`}
                                  data-testid="category-link"
                                >
                                  {child.name}
                                </LocalizedClientLink>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {collections && collections.length > 0 && (
              <div className="flex flex-col gap-y-3">
                <span className="text-sm font-bold">Collections</span>
                <ul className="grid gap-2">
                  {collections.slice(0, 6).map((c) => (
                    <li key={c.id}>
                      <LocalizedClientLink
                        className={linkClass}
                        href={`/collections/${c.handle}`}
                      >
                        {c.title}
                      </LocalizedClientLink>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-y-3">
              <span className="text-sm font-bold">Explore</span>
              <ul className="grid gap-2">
                {[
                  ["Store", "/store"],
                  ["Restaurants", "/restaurants"],
                  ["Book an appointment", "/book"],
                  ["Rent", "/rent"],
                  ["Digital products", "/digital-products"],
                  ["My account", "/account"],
                ].map(([label, href]) => (
                  <li key={href}>
                    <LocalizedClientLink className={linkClass} href={href}>
                      {label}
                    </LocalizedClientLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center justify-between gap-3 border-t border-line py-6 text-sm text-muted">
          <span>
            © {new Date().getFullYear()} {getStoreName()}. All rights reserved.
          </span>
          <div className="flex flex-wrap items-center gap-4">
            <ThemeToggle />
            <MedusaCTA />
          </div>
        </div>
      </div>
    </footer>
  )
}
