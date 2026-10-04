"use client"

import { usePathname } from "next/navigation"
import React from "react"

import { useCart } from "@lib/context/cart-context"
import { convertToLocale } from "@lib/util/money"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { BagIcon } from "@modules/common/icons/ui-icons"

/**
 * Header cart button. It is a real link to /cart, so it works without
 * JavaScript and with a modified click (new tab). A plain click opens the
 * cart drawer instead, except on pages that already show the full cart.
 */
export default function CartButton() {
  const { cart, itemCount, openDrawer } = useCart()
  const pathname = usePathname() ?? ""
  const onCartPage = /\/(cart|checkout)(\/|$)/.test(pathname)

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (
      onCartPage ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }
    event.preventDefault()
    openDrawer()
  }

  const hasItems = itemCount > 0

  return (
    <LocalizedClientLink
      href="/cart"
      onClick={handleClick}
      data-testid="nav-cart-link"
      className={
        hasItems
          ? "flex h-11 items-center gap-2 rounded-large bg-success px-3 text-sm small:px-4 font-bold text-success-ink"
          : "flex h-11 items-center gap-2 rounded-large border border-line bg-canvas px-3 text-sm small:px-4 font-bold text-ink"
      }
    >
      <BagIcon size={18} />
      <span>{`Cart (${itemCount})`}</span>
      {hasItems && cart?.currency_code && (
        <span className="hidden font-medium opacity-90 small:inline">
          {`· ${convertToLocale({
            amount: Number(cart.item_subtotal ?? cart.subtotal ?? 0),
            currency_code: cart.currency_code,
          })}`}
        </span>
      )}
    </LocalizedClientLink>
  )
}
