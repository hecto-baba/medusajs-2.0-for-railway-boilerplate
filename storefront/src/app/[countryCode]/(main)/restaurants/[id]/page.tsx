"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import Chip from "@modules/common/components/chip"
import Breadcrumbs from "@modules/common/components/breadcrumbs"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import {
  AddButton,
  ConflictDialog,
  CoverTile,
  ErrorBanner,
  SuccessBanner,
} from "../_components/shared"
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
      <div className="content-container flex items-center justify-center py-16">
        <p className="animate-pulse text-muted">Loading restaurant and menu...</p>
      </div>
    )
  }

  if (!restaurant) {
    return (
      <div className="content-container py-16 text-center">
        <h1 className="mb-3 font-display text-3xl font-extrabold tracking-tight text-ink">
          Restaurant Not Found
        </h1>
        <p className="mb-6 text-muted">
          The restaurant you are looking for does not exist or is currently unavailable.
        </p>
        <Link
          href={`/${countryCode}/restaurants`}
          className="inline-flex h-11 items-center rounded-large bg-brand px-5 text-sm font-extrabold text-brand-ink hover:opacity-90"
        >
          Back to Restaurants
        </Link>
      </div>
    )
  }

  const dietLabel: Record<string, string> = {
    veg: "Veg",
    non_veg: "Non-Veg",
    egg: "Egg",
    vegan: "Vegan",
  }

  return (
    <div className="content-container py-8">
      {successItemTitle && <SuccessBanner title={successItemTitle} />}
      {errorBanner && (
        <ErrorBanner message={errorBanner} onDismiss={() => setErrorBanner(null)} />
      )}

      <div className="flex items-center justify-between">
        <Breadcrumbs
          items={[
            { label: "Restaurants", href: "/restaurants" },
            { label: restaurant.name },
          ]}
        />
        <LocalizedClientLink
          href="/cart"
          className="mb-4 text-sm font-bold text-brand hover:underline"
        >
          View cart ›
        </LocalizedClientLink>
      </div>

      <div className="mb-8 flex items-start gap-4 rounded-large bg-card p-5 shadow-lift">
        <CoverTile
          src={restaurant.image_url}
          name={restaurant.name}
          className="h-20 w-20 shrink-0 rounded-[12px]"
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="break-words font-display text-2xl font-extrabold tracking-tight text-ink small:text-3xl">
              {restaurant.name}
            </h1>
            <Chip tone={restaurant.is_open ? "success" : "muted"}>
              {restaurant.is_open ? "Open now" : "Closed"}
            </Chip>
          </div>
          <div className="mt-2 flex flex-col gap-y-0.5 text-xs text-muted">
            {restaurant.address && restaurant.address !== "N/A" && (
              <span className="break-words">{restaurant.address}</span>
            )}
            {restaurant.phone && restaurant.phone !== "N/A" && (
              <span>{restaurant.phone}</span>
            )}
            {restaurant.email && (
              <span className="break-all">{restaurant.email}</span>
            )}
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-4 font-display text-2xl font-extrabold tracking-tight text-ink">
          Menu ({products.length})
        </h2>

        {products.length === 0 ? (
          <div className="rounded-large bg-card p-12 text-center shadow-lift">
            <p className="text-sm text-muted">
              No products currently available on this menu.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 small:grid-cols-2">
            {products.map((product: any) => {
              const activeVariant = getActiveVariant(product)
              const priceDisplay =
                getTotalProductPriceDisplay(product, activeVariant) ||
                getVariantPriceDisplay(activeVariant)
              const variantId = activeVariant?.id
              const isAdding = addingVariantId === variantId
              const hasMultipleVariants = (product.variants?.length || 0) > 1
              const currentSelectedAddons = selectedAddons[product.id] || []
              const diet = dietLabel[product.metadata?.dietary_type as string]

              return (
                <div
                  key={product.id}
                  className="flex min-w-0 flex-col justify-between rounded-large bg-card p-5 shadow-lift"
                >
                  <div>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <p className="break-words font-display text-base font-extrabold tracking-tight text-ink">
                            {product.title}
                          </p>
                          {diet && <Chip tone="muted">{diet}</Chip>}
                          {product.metadata?.promo_badge && (
                            <Chip tone="pop">
                              {String(product.metadata.promo_badge)}
                            </Chip>
                          )}
                        </div>

                        {priceDisplay && (
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="text-base font-bold tabular-nums text-ink">
                              {priceDisplay}
                            </span>
                            {currentSelectedAddons.length > 0 && (
                              <Chip tone="success">
                                {currentSelectedAddons.length} extra
                                {currentSelectedAddons.length > 1 ? "s" : ""} selected
                              </Chip>
                            )}
                          </div>
                        )}

                        {product.description && (
                          <p className="mt-2 line-clamp-2 text-sm text-muted">
                            {product.description}
                          </p>
                        )}
                      </div>

                      <CoverTile
                        src={product.thumbnail}
                        name={product.title}
                        className="h-20 w-20 shrink-0 rounded-[12px]"
                      />
                    </div>

                    {hasMultipleVariants && (
                      <div className="mt-4 border-t border-line pt-3">
                        <p className="mb-1.5 text-xs font-extrabold uppercase tracking-wider text-muted">
                          Select Portion
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {product.variants.map((v: any) => {
                            const isSelected = activeVariant?.id === v.id
                            const vPrice = getVariantPriceDisplay(v)
                            return (
                              <button
                                key={v.id}
                                type="button"
                                aria-pressed={isSelected}
                                onClick={() => handleSelectVariant(product.id, v.id)}
                                className={`rounded-rounded border px-3 py-1.5 text-xs font-bold transition-colors ${
                                  isSelected
                                    ? "border-brand bg-brand-soft text-brand"
                                    : "border-line bg-card text-ink hover:border-brand"
                                }`}
                              >
                                <span>{v.title}</span>
                                {vPrice && (
                                  <span className="ml-1 text-[10px] font-medium opacity-80">
                                    ({vPrice})
                                  </span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {product.metadata?.addons &&
                      Array.isArray(product.metadata.addons) &&
                      product.metadata.addons.length > 0 && (
                        <div className="mt-3 border-t border-line pt-3">
                          <p className="mb-1.5 text-xs font-extrabold uppercase tracking-wider text-muted">
                            Optional Add-ons &amp; Extras
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {product.metadata.addons.map((addon: any, aIdx: number) => {
                              const isSelected = currentSelectedAddons.includes(addon.name)
                              const addonPrice =
                                addon.price != null ? Number(addon.price).toFixed(2) : "0.00"
                              return (
                                <button
                                  key={aIdx}
                                  type="button"
                                  aria-pressed={isSelected}
                                  onClick={() => handleToggleAddon(product.id, addon.name)}
                                  className={`inline-flex items-center gap-1.5 rounded-rounded border px-3 py-1.5 text-xs font-bold transition-colors ${
                                    isSelected
                                      ? "border-brand bg-brand-soft text-brand"
                                      : "border-line bg-card text-ink hover:border-brand"
                                  }`}
                                >
                                  <span>{isSelected ? "✓" : "+"}</span>
                                  <span>{addon.name}</span>
                                  <span className="text-[10px] font-medium opacity-80">
                                    ({addonPrice === "0.00" ? "Free" : `+€${addonPrice}`})
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                  </div>

                  <div className="mt-4 flex justify-end border-t border-line pt-3">
                    <AddButton
                      closed={!restaurant.is_open}
                      disabled={!variantId || !restaurant.is_open}
                      loading={isAdding}
                      label="ADD"
                      ariaLabel={`Add ${product.title} to cart`}
                      onClick={() => handleAddToCart(product)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {conflictModal.open && (
        <ConflictDialog
          message={conflictModal.message}
          onCancel={() => setConflictModal({ open: false, product: null, message: "" })}
          onConfirm={handleClearAndAdd}
        />
      )}
    </div>
  )
}
