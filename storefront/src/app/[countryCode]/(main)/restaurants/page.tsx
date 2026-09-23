"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button, Badge, Heading, Text } from "@medusajs/ui"
import { addToCart, clearCartAndAdd } from "@lib/data/cart"

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

type Restaurant = {
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

export default function RestaurantsPage() {
  const params = useParams<{ countryCode: string }>()
  const countryCode = params?.countryCode || "us"

  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)
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
  }, [])

  const handleAddToCart = async (product: Product, restaurant: Restaurant) => {
    const variantId = product.variants?.[0]?.id
    if (!variantId) return

    setAddingVariantId(variantId)
    setErrorBanner(null)

    try {
      await addToCart({
        variantId,
        quantity: 1,
        countryCode,
        metadata: {
          restaurant_id: restaurant.id,
          restaurant_name: restaurant.name,
        },
      })
      setSuccessItemTitle(product.title)
      setTimeout(() => setSuccessItemTitle(null), 3000)
    } catch (err: any) {
      const msg = err.message || "Failed to add item to cart"
      if (
        msg.includes("CONFLICT_RETAIL_EXISTS") ||
        msg.includes("CONFLICT_RESTAURANT_EXISTS")
      ) {
        setConflictModal({
          open: true,
          product,
          restaurant,
          message: msg.replace(/^[A-Z_]+:\s*/, ""),
        })
      } else {
        setErrorBanner(msg)
      }
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
      await clearCartAndAdd({
        variantId,
        quantity: 1,
        countryCode,
        metadata: {
          restaurant_id: restaurant.id,
          restaurant_name: restaurant.name,
        },
      })
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
      <div className="content-container py-16 flex justify-center items-center">
        <Text className="text-ui-fg-subtle animate-pulse">
          Loading restaurants...
        </Text>
      </div>
    )
  }

  if (restaurants.length === 0) {
    return (
      <div className="content-container py-16 text-center">
        <Heading level="h1" className="text-2xl font-bold mb-4">Restaurants</Heading>
        <Text className="text-ui-fg-muted">No restaurants found at the moment.</Text>
      </div>
    )
  }

  return (
    <div className="content-container py-12 max-w-5xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ui-border-base pb-6 mb-8">
        <div>
          <Heading level="h1" className="text-2xl md:text-3xl font-bold text-ui-fg-base">
            Restaurants
          </Heading>
          <Text className="text-ui-fg-subtle text-sm mt-1">
            Browse local restaurants and menus.
          </Text>
        </div>
        <Link
          href={`/${countryCode}/cart`}
          className="txt-compact-small text-ui-fg-interactive font-medium hover:underline self-start sm:self-auto"
        >
          View Cart
        </Link>
      </div>

      {/* Success Notification */}
      {successItemTitle && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-green-800 text-sm flex items-center justify-between mb-6">
          <span>
            ✅ Added <strong>{successItemTitle}</strong> to your cart.
          </span>
          <Link
            href={`/${countryCode}/cart`}
            className="text-xs font-semibold underline hover:text-green-900"
          >
            View Cart →
          </Link>
        </div>
      )}

      {/* Error Banner */}
      {errorBanner && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-amber-800 text-sm flex items-center justify-between mb-6">
          <span>{errorBanner}</span>
          <button
            onClick={() => setErrorBanner(null)}
            className="text-xs text-amber-700 hover:text-amber-900 ml-4 font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Restaurant List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {restaurants.map((restaurant) => (
          <div
            key={restaurant.id}
            className="rounded-xl border border-ui-border-base bg-ui-bg-base p-6 shadow-sm flex flex-col justify-between hover:border-ui-border-interactive transition-colors"
          >
            <div>
              {restaurant.image_url && (
                <div className="mb-4 overflow-hidden rounded-lg max-h-44">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={restaurant.image_url}
                    alt={restaurant.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <Link
                    href={`/${countryCode}/restaurants/${restaurant.id}`}
                    className="text-lg font-bold text-ui-fg-base hover:text-ui-fg-interactive transition-colors"
                  >
                    {restaurant.name} →
                  </Link>
                  {restaurant.address && (
                    <Text className="text-ui-fg-subtle text-xs mt-0.5">
                      📍 {restaurant.address}
                    </Text>
                  )}
                </div>
                <Badge
                  color={restaurant.is_open ? "green" : "grey"}
                  size="small"
                >
                  {restaurant.is_open ? "Open" : "Closed"}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-ui-fg-muted mb-4 border-b border-ui-border-base pb-3">
                <div className="flex flex-wrap gap-x-3">
                  {restaurant.phone && <span>📞 {restaurant.phone}</span>}
                  {restaurant.email && <span>✉️ {restaurant.email}</span>}
                </div>
                <Link
                  href={`/${countryCode}/restaurants/${restaurant.id}`}
                  className="font-medium text-ui-fg-interactive hover:underline"
                >
                  View Menu ↗
                </Link>
              </div>

              <div>
                <Text className="txt-small font-semibold text-ui-fg-base mb-2">
                  Menu Preview ({restaurant.products?.length || 0} items)
                </Text>
                {!restaurant.products || restaurant.products.length === 0 ? (
                  <Text className="text-xs text-ui-fg-muted italic">
                    No products currently listed.
                  </Text>
                ) : (
                  <div className="flex flex-col divide-y divide-ui-border-base">
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
                          className="py-2.5 flex justify-between items-center gap-4"
                        >
                          <div className="flex-1 pr-2">
                            <Text className="txt-compact-small font-medium text-ui-fg-base">
                              {product.title}
                            </Text>
                            {priceDisplay && (
                              <Text className="txt-compact-xsmall text-ui-fg-subtle">
                                {priceDisplay}
                              </Text>
                            )}
                          </div>

                          {variant && (
                            <Button
                              size="small"
                              variant="secondary"
                              disabled={!restaurant.is_open || isAdding}
                              isLoading={isAdding}
                              onClick={() =>
                                handleAddToCart(product, restaurant)
                              }
                            >
                              {!restaurant.is_open ? "Closed" : "+ Add"}
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cart Conflict Modal */}
      {conflictModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-ui-bg-base rounded-xl max-w-md w-full p-6 shadow-xl border border-ui-border-base">
            <Heading level="h3" className="text-base font-bold text-ui-fg-base mb-2">
              Replace Cart Items?
            </Heading>
            <Text className="text-sm text-ui-fg-subtle mb-6">
              {conflictModal.message}
            </Text>
            <div className="flex items-center justify-end gap-3">
              <Button
                size="small"
                variant="secondary"
                onClick={() =>
                  setConflictModal({
                    open: false,
                    product: null,
                    restaurant: null,
                    message: "",
                  })
                }
              >
                Cancel
              </Button>
              <Button
                size="small"
                variant="danger"
                onClick={handleClearAndAdd}
              >
                Clear Cart & Add
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
