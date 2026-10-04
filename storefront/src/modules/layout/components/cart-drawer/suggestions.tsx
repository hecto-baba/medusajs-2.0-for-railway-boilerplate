"use client"

import Image from "next/image"
import { useParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

import { useCart } from "@lib/context/cart-context"
import { CartSuggestion, getCartSuggestions } from "@lib/data/suggestions"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Price from "@modules/common/components/price"
import QtyStepper from "@modules/common/components/qty-stepper"

/**
 * Horizontal rail of one-tap products under the cart lines. Loaded when the
 * drawer opens, so it adds nothing to normal page loads. Items stay in the
 * rail after being added (as steppers) so they can be taken back out.
 */
const CartSuggestions = ({ excludeProductIds }: { excludeProductIds: string[] }) => {
  const { countryCode } = useParams() as { countryCode: string }
  const cart = useCart()
  const [items, setItems] = useState<CartSuggestion[]>([])
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  // Reload only when the set of products in the cart changes, not on every
  // quantity change, so the rail does not flicker while stepping.
  const key = useMemo(
    () => [...excludeProductIds].sort().join(","),
    [excludeProductIds]
  )

  useEffect(() => {
    if (!cart.drawerOpen || loadedFor === key) return
    let cancelled = false
    getCartSuggestions({ countryCode, excludeProductIds }).then((result) => {
      if (cancelled) return
      setItems((current) => {
        // Keep anything already added so it does not vanish mid-edit.
        const added = current.filter((c) => cart.quantityFor(c.variantId) > 0)
        const ids = new Set(added.map((a) => a.productId))
        return [...added, ...result.filter((r) => !ids.has(r.productId))]
      })
      setLoadedFor(key)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.drawerOpen, key, countryCode])

  if (!items.length) {
    return null
  }

  return (
    <section
      className="min-w-0"
      data-testid="cart-suggestions"
      aria-label="Complete your cart"
    >
      <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted">
        Complete your cart
      </p>
      <ul className="no-scrollbar -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
        {items.map((item) => (
          <li
            key={item.productId}
            className="flex w-[140px] shrink-0 flex-col gap-1.5 rounded-large bg-card p-2.5 shadow-lift"
            data-testid="cart-suggestion"
          >
            <LocalizedClientLink
              href={`/products/${item.handle}`}
              onClick={cart.closeDrawer}
              className="flex flex-col gap-1.5"
              aria-label={item.title}
            >
              <span className="relative block aspect-[1/0.86] overflow-hidden rounded-[10px] bg-canvas">
                {item.thumbnail && (
                  <Image
                    src={item.thumbnail}
                    alt=""
                    fill
                    sizes="140px"
                    className="object-contain p-1.5"
                  />
                )}
              </span>
              <span className="line-clamp-2 min-h-[2rem] text-xs font-bold leading-tight">
                {item.title}
              </span>
            </LocalizedClientLink>
            <div className="mt-auto flex flex-wrap items-center justify-between gap-1.5">
              <Price
                amount={item.amount}
                originalAmount={item.originalAmount}
                currencyCode={item.currencyCode}
                size="sm"
                className="flex-col !items-start gap-0"
              />
              <QtyStepper
                quantity={cart.quantityFor(item.variantId)}
                max={item.max && item.max > 0 ? item.max : undefined}
                label={item.title}
                pending={cart.isPending(item.variantId)}
                onIncrement={() => cart.increment(item.variantId)}
                onDecrement={() => cart.decrement(item.variantId)}
                data-testid="suggestion-stepper"
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default CartSuggestions
