"use client"

import { clx } from "@medusajs/ui"
import { useParams, usePathname } from "next/navigation"
import React from "react"

import { useCart } from "@lib/context/cart-context"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import {
  BagIcon,
  GridIcon,
  HomeIcon,
  UserIcon,
} from "@modules/common/icons/ui-icons"

const itemClass =
  "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-bold transition-colors"

/**
 * Bottom navigation for phones: the four places a shopper goes most. Hidden
 * from the "small" breakpoint up, where the header carries all of it.
 */
const MobileNav = () => {
  const pathname = usePathname() ?? ""
  const { countryCode } = useParams() as { countryCode: string }
  const { itemCount, openDrawer } = useCart()

  const path = pathname.replace(new RegExp(`^/${countryCode}`), "") || "/"
  const is = (prefix: string) =>
    prefix === "/" ? path === "/" : path === prefix || path.startsWith(`${prefix}/`)

  const tone = (active: boolean) => (active ? "text-brand" : "text-muted")

  // A product page has its own sticky "Add to cart" bar at the bottom of the
  // screen; the two would sit on top of each other, so the bar takes over.
  if (is("/products")) {
    return null
  }

  return (
    <>
      {/* Keeps the last content clear of the fixed bar. */}
      <div className="h-16 small:hidden" aria-hidden="true" />
      <nav
        aria-label="Quick navigation"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-card pb-[env(safe-area-inset-bottom,0px)] shadow-pop small:hidden"
        data-testid="mobile-nav"
      >
        <LocalizedClientLink
          href="/"
          className={clx(itemClass, tone(is("/")))}
          aria-current={is("/") ? "page" : undefined}
          data-testid="mobile-nav-home"
        >
          <HomeIcon size={22} />
          Home
        </LocalizedClientLink>
        <LocalizedClientLink
          href="/store"
          className={clx(itemClass, tone(is("/store") || is("/categories") || is("/collections")))}
          aria-current={is("/store") ? "page" : undefined}
          data-testid="mobile-nav-shop"
        >
          <GridIcon size={22} />
          Shop
        </LocalizedClientLink>
        <button
          type="button"
          onClick={openDrawer}
          className={clx(itemClass, tone(is("/cart")))}
          data-testid="mobile-nav-cart"
        >
          <span className="relative">
            <BagIcon size={22} />
            {itemCount > 0 && (
              <span
                className="absolute -right-2.5 -top-2 grid h-4 min-w-[1rem] place-items-center rounded-circle bg-brand px-1 text-[10px] font-extrabold leading-none text-brand-ink"
                data-testid="mobile-nav-cart-count"
              >
                {itemCount}
              </span>
            )}
          </span>
          Cart
        </button>
        <LocalizedClientLink
          href="/account"
          className={clx(itemClass, tone(is("/account")))}
          aria-current={is("/account") ? "page" : undefined}
          data-testid="mobile-nav-account"
        >
          <UserIcon size={22} />
          Account
        </LocalizedClientLink>
      </nav>
    </>
  )
}

export default MobileNav
