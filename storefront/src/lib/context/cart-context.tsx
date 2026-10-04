"use client"

import { HttpTypes } from "@medusajs/types"
import { useParams } from "next/navigation"
import dynamic from "next/dynamic"
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react"

import {
  addToCart,
  clearCartAndAdd,
  deleteLineItem,
  updateLineItem,
} from "@lib/data/cart"
import { isCartConflict, isCartFailure } from "@lib/util/cart-conflict"
import { isAppointmentLineItem } from "types/appointment"
import { isTicketLineItem } from "types/ticket"

const ConflictModal = dynamic(
  () => import("@modules/layout/components/cart-drawer/conflict-modal"),
  { ssr: false }
)

type Cart = HttpTypes.StoreCart
type LineItem = HttpTypes.StoreCartLineItem

/**
 * Lines whose quantity is fixed by what they are: a rental has dates, a ticket
 * is one seat, an appointment is one booking, an EOI is a deposit and the
 * rental deposit is a companion line. They can be removed but not stepped.
 */
export const isAdjustableLine = (item: {
  metadata?: Record<string, unknown> | null
}) => {
  const m = item.metadata
  return !(
    m?.is_rental_deposit ||
    m?.rental_start_date ||
    m?.is_eoi ||
    isTicketLineItem(m) ||
    isAppointmentLineItem(m)
  )
}

/** A plain store purchase: adjustable and not a restaurant dish. */
export const isPlainLine = (item: {
  metadata?: Record<string, unknown> | null
}) => isAdjustableLine(item) && !item.metadata?.restaurant_id

type QtyEntry = { qty: number; lineId?: string }
type QtyMap = Record<string, QtyEntry>

type Conflict = { variantId: string; message: string }

type CartContextValue = {
  cart: Cart | null
  /** Items in the cart, including one-click changes still being saved. */
  itemCount: number
  /** Quantity of a plain line for this variant, including pending changes. */
  quantityFor: (variantId: string) => number
  /** True while a change for this variant is being saved. */
  isPending: (variantId: string) => boolean
  increment: (variantId: string) => void
  decrement: (variantId: string) => void
  /** Step a line shown in the drawer. Works for any adjustable line. */
  incrementLine: (item: LineItem) => void
  decrementLine: (item: LineItem) => void
  removeLine: (item: LineItem) => void
  drawerOpen: boolean
  openDrawer: () => void
  closeDrawer: () => void
  /** Items being added from a product page and not yet saved. */
  pendingAdds: number
  /**
   * Shows an add that is still being saved: opens the drawer, counts the items
   * straight away, and rolls both back with a message if the add fails. The
   * caller still awaits its own promise.
   */
  trackAdd: (promise: Promise<unknown>, quantity?: number) => void
}

const CartContext = createContext<CartContextValue | null>(null)

export const useCart = () => {
  const value = useContext(CartContext)
  if (!value) {
    throw new Error("useCart must be used inside <CartProvider>")
  }
  return value
}

const toQtyMap = (cart: Cart | null): QtyMap => {
  const map: QtyMap = {}
  for (const item of cart?.items ?? []) {
    if (item.variant_id && isPlainLine(item)) {
      const existing = map[item.variant_id]
      map[item.variant_id] = {
        qty: (existing?.qty ?? 0) + item.quantity,
        lineId: existing?.lineId ?? item.id,
      }
    }
  }
  return map
}

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong"

export const CartProvider = ({
  cart,
  children,
}: {
  cart: Cart | null
  children: React.ReactNode
}) => {
  const { countryCode } = useParams() as { countryCode: string }
  const real = useMemo(() => toQtyMap(cart), [cart])
  const [qtyMap, setOptimistic] = useOptimistic(
    real,
    (state: QtyMap, change: { variantId: string; qty: number }) => ({
      ...state,
      [change.variantId]: { ...state[change.variantId], qty: change.qty },
    })
  )
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const [, startTransition] = useTransition()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pendingAdds, setPendingAdds] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [conflict, setConflict] = useState<Conflict | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const showNotice = useCallback((message: string) => {
    setNotice(message)
    clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), 5000)
  }, [])

  useEffect(() => () => clearTimeout(noticeTimer.current), [])

  const openDrawer = useCallback(() => setDrawerOpen(true), [])

  const trackAdd = useCallback(
    (promise: Promise<unknown>, quantity = 1) => {
      setPendingAdds((n) => n + quantity)
      setDrawerOpen(true)
      promise
        .then((result) => {
          if (isCartConflict(result)) {
            setDrawerOpen(false)
            showNotice(result.message)
          } else if (isCartFailure(result)) {
            setDrawerOpen(false)
            showNotice(result.error)
          }
        })
        .catch((error) => {
          setDrawerOpen(false)
          showNotice(messageOf(error))
        })
        .finally(() => setPendingAdds((n) => Math.max(0, n - quantity)))
    },
    [showNotice]
  )
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  // Other flows (rentals, bookings, tickets) can ask for the drawer without
  // importing this context: window.dispatchEvent(new Event("cart:open")).
  useEffect(() => {
    const open = () => setDrawerOpen(true)
    window.addEventListener("cart:open", open)
    return () => window.removeEventListener("cart:open", open)
  }, [])

  const run = useCallback(
    (
      key: string,
      change: { variantId: string; qty: number } | null,
      action: () => Promise<unknown>
    ) => {
      startTransition(async () => {
        setPending((p) => ({ ...p, [key]: true }))
        if (change) {
          setOptimistic(change)
        }
        try {
          const result = await action()
          if (isCartConflict(result)) {
            setConflict({ variantId: key, message: result.message })
          } else if (isCartFailure(result)) {
            showNotice(result.error)
          }
        } catch (error) {
          showNotice(messageOf(error))
        } finally {
          setPending((p) => {
            const next = { ...p }
            delete next[key]
            return next
          })
        }
      })
    },
    [setOptimistic, showNotice]
  )

  const increment = useCallback(
    (variantId: string) => {
      const entry = qtyMap[variantId]
      const qty = (entry?.qty ?? 0) + 1
      run(variantId, { variantId, qty }, () =>
        entry?.lineId
          ? updateLineItem({ lineId: entry.lineId, quantity: qty })
          : addToCart({ variantId, quantity: 1, countryCode })
      )
    },
    [countryCode, qtyMap, run]
  )

  const decrement = useCallback(
    (variantId: string) => {
      const entry = qtyMap[variantId]
      if (!entry?.lineId) return
      const qty = Math.max(0, entry.qty - 1)
      run(variantId, { variantId, qty }, () =>
        qty === 0
          ? deleteLineItem(entry.lineId!)
          : updateLineItem({ lineId: entry.lineId!, quantity: qty })
      )
    },
    [qtyMap, run]
  )

  const incrementLine = useCallback(
    (item: LineItem) => {
      if (item.variant_id && isPlainLine(item)) {
        increment(item.variant_id)
        return
      }
      run(item.id, null, () =>
        updateLineItem({ lineId: item.id, quantity: item.quantity + 1 })
      )
    },
    [increment, run]
  )

  const decrementLine = useCallback(
    (item: LineItem) => {
      if (item.variant_id && isPlainLine(item)) {
        decrement(item.variant_id)
        return
      }
      run(item.id, null, () =>
        item.quantity <= 1
          ? deleteLineItem(item.id)
          : updateLineItem({ lineId: item.id, quantity: item.quantity - 1 })
      )
    },
    [decrement, run]
  )

  const removeLine = useCallback(
    (item: LineItem) => {
      const key = item.variant_id && isPlainLine(item) ? item.variant_id : item.id
      run(
        key,
        item.variant_id && isPlainLine(item)
          ? { variantId: item.variant_id, qty: 0 }
          : null,
        () => deleteLineItem(item.id)
      )
    },
    [run]
  )

  const itemCount = useMemo(() => {
    const base = (cart?.items ?? []).reduce((sum, item) => sum + item.quantity, 0)
    const delta = Object.keys({ ...real, ...qtyMap }).reduce(
      (sum, variantId) =>
        sum + ((qtyMap[variantId]?.qty ?? 0) - (real[variantId]?.qty ?? 0)),
      0
    )
    return Math.max(0, base + delta + pendingAdds)
  }, [cart, real, qtyMap, pendingAdds])

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      itemCount,
      quantityFor: (variantId) => qtyMap[variantId]?.qty ?? 0,
      isPending: (variantId) => !!pending[variantId],
      increment,
      decrement,
      incrementLine,
      decrementLine,
      removeLine,
      drawerOpen,
      openDrawer,
      closeDrawer,
      pendingAdds,
      trackAdd,
    }),
    [
      cart,
      itemCount,
      qtyMap,
      pending,
      increment,
      decrement,
      incrementLine,
      decrementLine,
      removeLine,
      drawerOpen,
      openDrawer,
      closeDrawer,
      pendingAdds,
      trackAdd,
    ]
  )

  const resolveConflict = () => {
    const current = conflict
    setConflict(null)
    if (!current) return
    run(current.variantId, null, () =>
      clearCartAndAdd({
        variantId: current.variantId,
        quantity: 1,
        countryCode,
      })
    )
  }

  return (
    <CartContext.Provider value={value}>
      {children}

      {notice && (
        <div
          role="status"
          aria-live="polite"
          data-testid="cart-notice"
          className="fixed bottom-6 left-1/2 z-[120] max-w-[90vw] -translate-x-1/2 rounded-circle bg-ink px-5 py-3 text-sm font-bold text-canvas shadow-pop"
        >
          {notice}
        </div>
      )}

      {conflict && (
        <ConflictModal
          isOpen
          message={conflict.message}
          onKeep={() => setConflict(null)}
          onReplace={resolveConflict}
        />
      )}
    </CartContext.Provider>
  )
}
