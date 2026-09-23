"use client"

import { useEffect, useState, useMemo } from "react"
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
  thumbnail?: string
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

export default function RestaurantDetailPage() {
  const params = useParams<{ countryCode: string; id: string }>()
  const countryCode = params?.countryCode || "us"
  const restaurantId = params?.id

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [addingVariantId, setAddingVariantId] = useState<string | null>(null)
  const [successItemTitle, setSuccessItemTitle] = useState<string | null>(null)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const [conflictModal, setConflictModal] = useState<{
    open: boolean
    product: Product | null
    message: string
  }>({
    open: false,
    product: null,
    message: "",
  })

  useEffect(() => {
    if (!restaurantId) return

    const backendUrl =
      process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

    const fetchRestaurant = async () => {
      setLoading(true)
      try {
        const res = await fetch(`${backendUrl}/restaurants/${restaurantId}`, {
          credentials: "include",
        })
        if (res.ok) {
          const data = await res.json()
          if (data.restaurant) {
            setRestaurant(data.restaurant)
            setLoading(false)
            return
          }
        }
      } catch (e) {}

      try {
        const res = await fetch(`${backendUrl}/restaurants?id=${restaurantId}`, {
          credentials: "include",
        })
        if (res.ok) {
          const data = await res.json()
          const found = (data.restaurants || []).find(
            (r: Restaurant) => r.id === restaurantId
          )
          if (found) {
            setRestaurant(found)
            setLoading(false)
            return
          }
        }
      } catch (err) {
        console.error("Failed to fetch restaurant:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchRestaurant()
  }, [restaurantId])

  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({})
  const [selectedAddons, setSelectedAddons] = useState<Record<string, string[]>>({})

  const handleSelectVariant = (productId: string, variantId: string) => {
    setSelectedVariants((prev) => ({
      ...prev,
      [productId]: variantId,
    }))
  }

  const handleToggleAddon = (productId: string, addonName: string) => {
    setSelectedAddons((prev) => {
      const current = prev[productId] || []
      if (current.includes(addonName)) {
        return { ...prev, [productId]: current.filter((name) => name !== addonName) }
      } else {
        return { ...prev, [productId]: [...current, addonName] }
      }
    })
  }

  const getActiveVariant = (product: Product): ProductVariant | undefined => {
    const selectedId = selectedVariants[product.id]
    if (selectedId && product.variants) {
      const found = product.variants.find((v) => v.id === selectedId)
      if (found) return found
    }
    return product.variants?.[0]
  }

  const getVariantPriceDisplay = (variant?: ProductVariant) => {
    if (!variant) return null
    if (variant.calculated_price?.calculated_amount) {
      return `${variant.calculated_price.calculated_amount} ${variant.calculated_price.currency_code?.toUpperCase()}`
    }
    if (variant.prices && variant.prices.length > 0) {
      const p = variant.prices[0]
      const formatted = p.amount >= 100 ? (p.amount / 100).toFixed(2) : Number(p.amount).toFixed(2)
      return `${p.currency_code?.toUpperCase()} ${formatted}`
    }
    return null
  }

  const getTotalProductPriceDisplay = (product: Product, activeVariant?: ProductVariant) => {
    if (!activeVariant) return null
    let baseAmount = 0
    let currency = "EUR"

    if (activeVariant.calculated_price?.calculated_amount) {
      baseAmount = Number(activeVariant.calculated_price.calculated_amount)
      currency = activeVariant.calculated_price.currency_code?.toUpperCase() || "EUR"
    } else if (activeVariant.prices && activeVariant.prices.length > 0) {
      const p = activeVariant.prices[0]
      baseAmount = p.amount >= 100 ? p.amount / 100 : Number(p.amount)
      currency = p.currency_code?.toUpperCase() || "EUR"
    }

    const currentAddons = selectedAddons[product.id] || []
    let addonsSum = 0
    const prodMeta = (product as any).metadata
    if (prodMeta?.addons && Array.isArray(prodMeta.addons)) {
      for (const addon of prodMeta.addons) {
        if (currentAddons.includes(addon.name) && addon.price != null) {
          addonsSum += Number(addon.price)
        }
      }
    }

    const total = baseAmount + addonsSum
    return `${currency} ${total.toFixed(2)}`
  }



  const handleAddToCart = async (product: Product) => {
    if (!restaurant) return
    const activeVariant = getActiveVariant(product)
    const variantId = activeVariant?.id
    if (!variantId) return

    setAddingVariantId(variantId)
    setErrorBanner(null)

    const currentSelectedAddons = selectedAddons[product.id] || []

    try {
      await addToCart({
        variantId,
        quantity: 1,
        countryCode,
        metadata: {
          restaurant_id: restaurant.id,
          restaurant_name: restaurant.name,
          portion: activeVariant.title,
          addons: currentSelectedAddons,
        },
      })
      const portionName = activeVariant.title && activeVariant.title !== "Default" && activeVariant.title !== "Regular"
        ? ` (${activeVariant.title})`
        : ""
      const addonsSuffix = currentSelectedAddons.length > 0 ? ` + ${currentSelectedAddons.join(", ")}` : ""
      setSuccessItemTitle(`${product.title}${portionName}${addonsSuffix}`)
      setTimeout(() => setSuccessItemTitle(null), 3500)
    } catch (err: any) {
      const msg = err.message || "Failed to add item to cart"
      if (
        msg.includes("CONFLICT_RETAIL_EXISTS") ||
        msg.includes("CONFLICT_RESTAURANT_EXISTS")
      ) {
        setConflictModal({
          open: true,
          product,
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
    if (!restaurant || !conflictModal.product) return
    const product = conflictModal.product
    const variantId = product.variants?.[0]?.id
    if (!variantId) return

    setAddingVariantId(variantId)
    setConflictModal({ open: false, product: null, message: "" })

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

  const getProductPrice = (product: Product) => {
    const variant = product.variants?.[0]
    if (!variant) return null
    if (variant.calculated_price?.calculated_amount) {
      return `${variant.calculated_price.calculated_amount} ${variant.calculated_price.currency_code?.toUpperCase()}`
    }
    if (variant.prices && variant.prices.length > 0) {
      const p = variant.prices[0]
      const formatted = p.amount >= 100 ? (p.amount / 100).toFixed(2) : Number(p.amount).toFixed(2)
      return `${p.currency_code?.toUpperCase()} ${formatted}`
    }
    return null
  }

  const products = useMemo(() => {
    return restaurant?.products || []
  }, [restaurant?.products])

  if (loading) {
    return (
      <div className="content-container py-16 flex justify-center items-center">
        <Text className="text-ui-fg-subtle animate-pulse">Loading restaurant and menu...</Text>
      </div>
    )
  }

  if (!restaurant) {
    return (
      <div className="content-container py-16 text-center">
        <Heading level="h1" className="text-2xl font-bold mb-4">Restaurant Not Found</Heading>
        <Text className="text-ui-fg-muted mb-6">
          The restaurant you are looking for does not exist or is currently unavailable.
        </Text>
        <Link
          href={`/${countryCode}/restaurants`}
          className="inline-block rounded-md bg-ui-bg-interactive px-4 py-2 text-sm text-white font-medium hover:opacity-90"
        >
          ← Back to Restaurants
        </Link>
      </div>
    )
  }

  return (
    <div className="content-container py-12 max-w-5xl mx-auto">
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

      {/* Breadcrumb & Navigation */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href={`/${countryCode}/restaurants`}
          className="txt-compact-small text-ui-fg-muted hover:text-ui-fg-base flex items-center gap-1"
        >
          <span>←</span>
          <span>All Restaurants</span>
        </Link>
        <Link
          href={`/${countryCode}/cart`}
          className="txt-compact-small text-ui-fg-interactive font-medium hover:underline"
        >
          View Cart
        </Link>
      </div>

      {/* Restaurant Header */}
      <div className="border-b border-ui-border-base pb-8 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            {restaurant.image_url && (
              <img
                src={restaurant.image_url}
                alt={restaurant.name}
                className="w-16 h-16 rounded-lg object-cover border border-ui-border-base flex-shrink-0"
              />
            )}
            <div>
              <div className="flex items-center gap-3">
                <Heading level="h1" className="text-2xl md:text-3xl font-bold text-ui-fg-base">
                  {restaurant.name}
                </Heading>
                <Badge color={restaurant.is_open ? "green" : "grey"} size="small">
                  {restaurant.is_open ? "Open" : "Closed"}
                </Badge>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ui-fg-subtle">
                {restaurant.address && restaurant.address !== "N/A" && (
                  <span>📍 {restaurant.address}</span>
                )}
                {restaurant.phone && restaurant.phone !== "N/A" && (
                  <span>📞 {restaurant.phone}</span>
                )}
                {restaurant.email && (
                  <span>✉️ {restaurant.email}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Menu Section */}
      <div>
        <div className="mb-6">
          <Heading level="h2" className="text-lg font-semibold text-ui-fg-base">
            Menu ({products.length})
          </Heading>
        </div>

        {products.length === 0 ? (
          <div className="rounded-xl border border-ui-border-base p-12 text-center bg-ui-bg-subtle">
            <Text className="text-ui-fg-muted text-sm">
              No products currently available on this menu.
            </Text>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {products.map((product: any) => {
              const activeVariant = getActiveVariant(product)
              const priceDisplay = getTotalProductPriceDisplay(product, activeVariant) || getVariantPriceDisplay(activeVariant)
              const variantId = activeVariant?.id
              const isAdding = addingVariantId === variantId
              const hasMultipleVariants = (product.variants?.length || 0) > 1
              const currentSelectedAddons = selectedAddons[product.id] || []

              return (
                <div
                  key={product.id}
                  className="rounded-xl border border-ui-border-base bg-ui-bg-base p-5 flex flex-col justify-between hover:border-ui-border-interactive transition-colors"
                >
                  <div>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Text className="txt-medium-plus font-bold text-ui-fg-base">
                            {product.title}
                          </Text>
                          {product.metadata?.dietary_type === "veg" && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-ui-bg-base text-ui-fg-base border border-ui-border-base">
                              Veg
                            </span>
                          )}
                          {product.metadata?.dietary_type === "non_veg" && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-ui-bg-subtle text-ui-fg-subtle border border-ui-border-base">
                              Non-Veg
                            </span>
                          )}
                          {product.metadata?.dietary_type === "egg" && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-ui-bg-subtle text-ui-fg-subtle border border-ui-border-base">
                              Egg
                            </span>
                          )}
                          {product.metadata?.dietary_type === "vegan" && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-ui-bg-base text-ui-fg-base border border-ui-border-base">
                              Vegan
                            </span>
                          )}
                          {product.metadata?.promo_badge && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-800 border border-blue-200">
                              {String(product.metadata.promo_badge)}
                            </span>
                          )}
                        </div>

                        {priceDisplay && (
                          <div className="flex items-center gap-2 mt-1">
                            <Text className="txt-medium text-ui-fg-base font-bold text-base">
                              {priceDisplay}
                            </Text>
                            {currentSelectedAddons.length > 0 && (
                              <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">
                                ({currentSelectedAddons.length} extra{currentSelectedAddons.length > 1 ? "s" : ""} selected)
                              </span>
                            )}
                          </div>
                        )}

                        {product.description && (
                          <Text className="txt-small text-ui-fg-subtle line-clamp-2 mt-2">
                            {product.description}
                          </Text>
                        )}
                      </div>

                      {product.thumbnail && (
                        <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border border-ui-border-base">
                          <img
                            src={product.thumbnail}
                            alt={product.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>

                    {/* Portion Size Variant Selector */}
                    {hasMultipleVariants && (
                      <div className="mt-4 pt-3 border-t border-ui-border-base">
                        <Text className="txt-compact-xsmall font-semibold text-ui-fg-subtle mb-1.5 uppercase tracking-wider">
                          Select Portion
                        </Text>
                        <div className="flex flex-wrap gap-1.5">
                          {product.variants.map((v: any) => {
                            const isSelected = activeVariant?.id === v.id
                            const vPrice = getVariantPriceDisplay(v)
                            return (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => handleSelectVariant(product.id, v.id)}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition cursor-pointer ${
                                  isSelected
                                    ? "bg-ui-bg-interactive text-white border-ui-border-interactive font-semibold shadow-xs"
                                    : "bg-ui-bg-subtle text-ui-fg-subtle border-ui-border-base hover:bg-ui-bg-base hover:text-ui-fg-base"
                                }`}
                              >
                                <span>{v.title}</span>
                                {vPrice && <span className="ml-1 opacity-80 text-[10px]">({vPrice})</span>}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Optional Add-ons & Toppings (Interactive Buttons) */}
                    {product.metadata?.addons && Array.isArray(product.metadata.addons) && product.metadata.addons.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-ui-border-base">
                        <Text className="txt-compact-xsmall font-semibold text-ui-fg-subtle mb-1.5 uppercase tracking-wider">
                          Optional Add-ons & Extras
                        </Text>
                        <div className="flex flex-wrap gap-2">
                          {product.metadata.addons.map((addon: any, aIdx: number) => {
                            const isSelected = currentSelectedAddons.includes(addon.name)
                            const addonPrice = addon.price != null ? Number(addon.price).toFixed(2) : "0.00"
                            return (
                              <button
                                key={aIdx}
                                type="button"
                                onClick={() => handleToggleAddon(product.id, addon.name)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer ${
                                  isSelected
                                    ? "bg-ui-bg-interactive text-white border-ui-border-interactive shadow-xs font-semibold"
                                    : "bg-ui-bg-subtle text-ui-fg-subtle border-ui-border-base hover:bg-ui-bg-base hover:border-ui-border-interactive hover:text-ui-fg-base"
                                }`}
                              >
                                <span>{isSelected ? "✓" : "+"}</span>
                                <span>{addon.name}</span>
                                <span className={`text-[10px] ${isSelected ? "text-white/90" : "text-ui-fg-muted font-normal"}`}>
                                  ({addonPrice === "0.00" ? "Free" : `+€${addonPrice}`})
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-ui-border-base flex justify-end">
                    <Button
                      size="small"
                      variant="primary"
                      disabled={isAdding || !variantId || !restaurant.is_open}
                      isLoading={isAdding}
                      onClick={() => handleAddToCart(product)}
                    >
                      {!restaurant.is_open ? "Closed" : "Add to cart"}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
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
                  setConflictModal({ open: false, product: null, message: "" })
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
