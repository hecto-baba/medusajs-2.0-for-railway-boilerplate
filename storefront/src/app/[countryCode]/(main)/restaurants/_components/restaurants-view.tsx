"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import Chip from "@modules/common/components/chip"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import {
  AddButton,
  ConflictDialog,
  CoverTile,
  ErrorBanner,
  SuccessBanner,
} from "./shared"
import { addToCart, clearCartAndAdd } from "@lib/data/cart"
import { isCartConflict, isCartFailure } from "@lib/util/cart-conflict"

type ProductVariant = {
  id: string
  title: string
  calculated_price?: {
    calculated_amount: number
    currency_code: string
  }
  prices?: {
    amount: number
    currency_code: string
  }[]
}

type Product = {
  id: string
  title: string
  description?: string
  variants?: ProductVariant[]
}

export type Restaurant = {
  id: string
  name: string
  handle: string
  address?: string
  phone?: string
  email?: string
  image_url?: string
  is_open: boolean
  products?: Product[]
}

export default function RestaurantsView({
  initialRestaurants,
}: {
  initialRestaurants: Restaurant[] | null
}) {
  const params = useParams<{ countryCode: string }>()
  const countryCode = params?.countryCode || "us"

  const [restaurants, setRestaurants] = useState<Restaurant[]>(
    initialRestaurants ?? []
  )
  const [loading, setLoading] = useState(initialRestaurants === null)
  const [addingVariantId, setAddingVariantId] = useState<string | null>(null)
  const [successItemTitle, setSuccessItemTitle] = useState<string | null>(null)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const [conflictModal, setConflictModal] = useState<{
    open: boolean
    product: Product | null
    restaurant: Restaurant | null
    message: string
  }>({
    open: false,
    product: null,
    restaurant: null,
    message: "",
  })

  useEffect(() => {
    // Server already supplied the list; only fetch client-side as a fallback.
    if (initialRestaurants !== null) return
    const backendUrl =
      process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

    fetch(`${backendUrl}/restaurants?currency_code=eur`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        setRestaurants(data.restaurants || [])
        setLoading(false)
      })
      .catch((err) => {
        console.error("Failed to fetch restaurants:", err)
        fetch(`${backendUrl}/store/restaurants`, {
          credentials: "include",
        })
          .then((res) => res.json())
          .then((data) => {
            setRestaurants(data.restaurants || [])
            setLoading(false)
          })
          .catch(() => setLoading(false))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAddToCart = async (product: Product, restaurant: Restaurant) => {
    const variantId = product.variants?.[0]?.id
    if (!variantId) return

    setAddingVariantId(variantId)
    setErrorBanner(null)

    try {
      const result = await addToCart({
        variantId,
        quantity: 1,
        countryCode,
        metadata: {
          restaurant_id: restaurant.id,
          restaurant_name: restaurant.name,
        },
      })
      if (isCartConflict(result)) {
        setConflictModal({
          open: true,
          product,
          restaurant,
          message: result.message,
        })
        return
      }
      if (isCartFailure(result)) {
        setErrorBanner(result.error)
        return
      }
      setSuccessItemTitle(product.title)
      setTimeout(() => setSuccessItemTitle(null), 3000)
    } catch (err: any) {
      setErrorBanner(err.message || "Failed to add item to cart")
    } finally {
      setAddingVariantId(null)
    }
  }

  const handleClearAndAdd = async () => {
    if (!conflictModal.restaurant || !conflictModal.product) return
    const { product, restaurant } = conflictModal
    const variantId = product.variants?.[0]?.id
    if (!variantId) return

    setAddingVariantId(variantId)
    setConflictModal({ open: false, product: null, restaurant: null, message: "" })

    try {
      const result = await clearCartAndAdd({
        variantId,
        quantity: 1,
        countryCode,
        metadata: {
          restaurant_id: restaurant.id,
          restaurant_name: restaurant.name,
        },
      })
      if (isCartConflict(result)) {
        setErrorBanner(result.message)
        return
      }
      if (isCartFailure(result)) {
        setErrorBanner(result.error)
        return
      }
      setSuccessItemTitle(product.title)
      setTimeout(() => setSuccessItemTitle(null), 3000)
    } catch (err: any) {
      setErrorBanner(err.message || "Failed to clear and add item")
    } finally {
      setAddingVariantId(null)
    }
  }

  if (loading) {
    return (
      <div className="content-container flex items-center justify-center py-16">
        <p className="animate-pulse text-muted">Loading restaurants...</p>
      </div>
    )
  }

  if (restaurants.length === 0) {
    return (
      <div className="content-container py-16 text-center">
        <h1 className="mb-3 font-display text-3xl font-extrabold tracking-tight text-ink">
          Restaurants
        </h1>
        <p className="text-muted">No restaurants found at the moment.</p>
      </div>
    )
  }

  return (
    <div className="content-container py-8">
      <div className="mb-6 flex flex-col justify-between gap-3 small:flex-row small:items-end">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink small:text-4xl">
            Restaurants
          </h1>
          <p className="mt-1 text-sm text-muted">
            Browse local restaurants and menus.
          </p>
        </div>
        <LocalizedClientLink
          href="/cart"
          className="self-start text-sm font-bold text-brand hover:underline small:self-auto"
        >
          View cart ›
        </LocalizedClientLink>
      </div>

      {successItemTitle && <SuccessBanner title={successItemTitle} />}
      {errorBanner && (
        <ErrorBanner message={errorBanner} onDismiss={() => setErrorBanner(null)} />
      )}

      <div className="grid grid-cols-1 gap-5 small:grid-cols-2">
        {restaurants.map((restaurant) => (
          <div
            key={restaurant.id}
            className="flex min-w-0 flex-col rounded-large bg-card p-5 shadow-lift"
          >
            <div className="flex items-start gap-4">
              <Link
                href={`/${countryCode}/restaurants/${restaurant.id}`}
                aria-label={`${restaurant.name} menu`}
                className="shrink-0"
              >
                <CoverTile
                  src={restaurant.image_url}
                  name={restaurant.name}
                  className="h-20 w-20 rounded-[12px]"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/${countryCode}/restaurants/${restaurant.id}`}
                    className="min-w-0 break-words font-display text-lg font-extrabold tracking-tight text-ink hover:text-brand"
                  >
                    {restaurant.name}
                  </Link>
                  <Chip tone={restaurant.is_open ? "success" : "muted"} className="shrink-0">
                    {restaurant.is_open ? "Open now" : "Closed"}
                  </Chip>
                </div>
                {restaurant.address && (
                  <p className="mt-1 text-xs text-muted">{restaurant.address}</p>
                )}
                {restaurant.phone && (
                  <p className="mt-0.5 text-xs text-muted">{restaurant.phone}</p>
                )}
                <Link
                  href={`/${countryCode}/restaurants/${restaurant.id}`}
                  className="mt-2 inline-block text-sm font-bold text-brand hover:underline"
                >
                  View menu ›
                </Link>
              </div>
            </div>

            <div className="mt-4 border-t border-line pt-3">
              <p className="mb-1 text-sm font-extrabold text-ink">
                Menu preview ({restaurant.products?.length || 0} items)
              </p>
              {!restaurant.products || restaurant.products.length === 0 ? (
                <p className="text-xs italic text-muted">
                  No products currently listed.
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-line">
                  {restaurant.products.slice(0, 3).map((product) => {
                    const variant = product.variants?.[0]
                    const calculated = variant?.calculated_price
                    const rawPrice = variant?.prices?.[0]
                    const priceDisplay = calculated
                      ? `${calculated.calculated_amount} ${calculated.currency_code?.toUpperCase()}`
                      : rawPrice
                      ? `$${(rawPrice.amount / 100).toFixed(2)}`
                      : null

                    const isAdding = addingVariantId === variant?.id

                    return (
                      <div
                        key={product.id}
                        className="flex items-center justify-between gap-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-bold text-ink">
                            {product.title}
                          </p>
                          {priceDisplay && (
                            <p className="text-xs font-bold tabular-nums text-muted">
                              {priceDisplay}
                            </p>
                          )}
                        </div>

                        {variant && (
                          <AddButton
                            closed={!restaurant.is_open}
                            disabled={!restaurant.is_open}
                            loading={isAdding}
                            ariaLabel={`Add ${product.title} to cart`}
                            onClick={() => handleAddToCart(product, restaurant)}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {conflictModal.open && (
        <ConflictDialog
          message={conflictModal.message}
          onCancel={() =>
            setConflictModal({
              open: false,
              product: null,
              restaurant: null,
              message: "",
            })
          }
          onConfirm={handleClearAndAdd}
        />
      )}
    </div>
  )
}
