import { Suspense } from "react"
import { listRegions } from "@lib/data/regions"
import { StoreRegion } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButton from "@modules/layout/components/cart-button"
import SideMenu from "@modules/layout/components/side-menu"
import { getStoreName, isSearchEnabled } from "@lib/util/env"
import { getCustomer } from "@lib/data/customer"

export default async function Nav() {
  const regions = await listRegions().then((regions: StoreRegion[]) => regions)
  const customer = await getCustomer().catch(() => null)

  return (
    <div className="sticky top-0 inset-x-0 z-50 group">
      <header className="relative h-16 mx-auto border-b duration-200 bg-white border-ui-border-base">
        <nav className="content-container txt-xsmall-plus text-ui-fg-subtle flex items-center justify-between w-full h-full text-small-regular">
          {/* Left: Side Menu */}
          <div className="flex-1 basis-0 h-full flex items-center">
            <div className="h-full">
              <SideMenu
                regions={regions}
                customerInfo={
                  customer
                    ? {
                        first_name: customer.first_name,
                        email: customer.email,
                      }
                    : null
                }
              />
            </div>
          </div>

          {/* Center: Store Brand Logo */}
          <div className="flex items-center h-full">
            <LocalizedClientLink
              href="/"
              className="txt-compact-xlarge-plus hover:text-ui-fg-base uppercase flex items-center gap-2"
              data-testid="nav-store-link"
            >
              <span>{getStoreName()}</span>
            </LocalizedClientLink>
          </div>

          {/* Right: Buyer Navigation */}
          <div className="flex items-center gap-x-6 h-full flex-1 basis-0 justify-end">
            <div className="hidden small:flex items-center gap-x-6 h-full">
              <LocalizedClientLink
                className="hover:text-ui-fg-base"
                href="/store"
                data-testid="nav-store-catalog-link"
              >
                Store
              </LocalizedClientLink>
              <LocalizedClientLink
                className="hover:text-ui-fg-base"
                href="/digital-products"
                data-testid="nav-digital-products-link"
              >
                Digital Products
              </LocalizedClientLink>
              <LocalizedClientLink
                className="hover:text-ui-fg-base"
                href="/restaurants"
                data-testid="nav-restaurants-link"
              >
                Restaurants
              </LocalizedClientLink>
              {isSearchEnabled() && (
                <LocalizedClientLink
                  className="hover:text-ui-fg-base"
                  href="/search"
                  scroll={false}
                  data-testid="nav-search-link"
                >
                  Search
                </LocalizedClientLink>
              )}
              <LocalizedClientLink
                className="hover:text-ui-fg-base"
                href="/account"
                data-testid="nav-account-link"
              >
                {customer?.first_name ? `Hi, ${customer.first_name}` : "Account"}
              </LocalizedClientLink>
            </div>
            <Suspense
              fallback={
                <LocalizedClientLink
                  className="hover:text-ui-fg-base flex gap-2"
                  href="/cart"
                  data-testid="nav-cart-link"
                >
                  Cart (0)
                </LocalizedClientLink>
              }
            >
              <CartButton />
            </Suspense>
          </div>
        </nav>
      </header>
    </div>
  )
}
