import { listCategories } from "@lib/data/categories"
import { getCustomer } from "@lib/data/customer"
import { getStoreName, isSearchEnabled } from "@lib/util/env"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import {
  SearchIcon,
  UserIcon,
} from "@modules/common/icons/ui-icons"
import CartButton from "@modules/layout/components/cart-button"
import CategoryNav, {
  NavCategory,
  NavVerticalLink,
} from "@modules/layout/components/category-nav"

export default async function Nav({ countryCode }: { countryCode?: string }) {
  const [customer, categories] = await Promise.all([
    getCustomer().catch(() => null),
    listCategories().catch(() => []),
  ])

  const navCategories: NavCategory[] = (categories ?? [])
    .filter((c) => !c.parent_category_id)
    .map((c) => ({
      id: c.id,
      name: c.name,
      handle: c.handle,
      children: (c.category_children ?? []).map((child) => ({
        id: child.id,
        name: child.name,
        handle: child.handle,
      })),
    }))

  const verticals: NavVerticalLink[] = [
    {
      label: "Restaurants",
      href: "/restaurants",
      testId: "nav-restaurants-link",
    },
    { label: "Book", href: "/book", testId: "nav-book-link" },
    { label: "Rent", href: "/rent", testId: "nav-rent-link" },
    {
      label: "Digital Products",
      href: "/digital-products",
      testId: "nav-digital-products-link",
    },
    ...(customer
      ? [
          {
            label: "My bookings",
            href: "/appointments/my",
            testId: "nav-my-bookings-link",
          },
        ]
      : []),
  ]

  return (
    <div className="sticky top-0 inset-x-0 z-50">
      <header className="relative border-b border-line bg-card text-ink">
        <div className="content-container">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 small:flex-nowrap small:gap-x-5">
            <div className="flex items-center gap-1">
              <LocalizedClientLink
                href="/"
                className="flex min-w-0 items-center gap-1 font-display text-2xl font-extrabold tracking-tight text-brand"
                data-testid="nav-store-link"
              >
                <span className="max-w-[4.5rem] truncate xsmall:max-w-[10rem] small:max-w-[14rem]">
                  {getStoreName()}
                </span>
              </LocalizedClientLink>
            </div>

            {isSearchEnabled() && (
              <LocalizedClientLink
                href="/search"
                scroll={false}
                data-testid="nav-search-link"
                className="order-last flex h-11 min-w-0 basis-full items-center gap-3 rounded-large border border-line bg-canvas px-4 text-sm text-muted transition-colors hover:border-muted small:order-none small:flex-1 small:basis-auto"
              >
                <SearchIcon size={18} className="shrink-0" />
                <span className="truncate">Search for products</span>
              </LocalizedClientLink>
            )}

            <div className="ml-auto flex items-center gap-1 small:ml-0 small:gap-2">
              <LocalizedClientLink
                href="/account"
                data-testid="nav-account-link"
                className="flex h-11 items-center gap-2 rounded-rounded px-3 text-sm font-bold hover:bg-canvas"
              >
                <UserIcon size={20} />
                <span className="hidden small:inline">
                  {customer?.first_name ? `Hi, ${customer.first_name}` : "Login"}
                </span>
                <span className="sr-only small:hidden">Account</span>
              </LocalizedClientLink>
              <CartButton />
            </div>
          </div>
        </div>
        <div className="content-container">
          <CategoryNav categories={navCategories} verticals={verticals} />
        </div>
      </header>
    </div>
  )
}
