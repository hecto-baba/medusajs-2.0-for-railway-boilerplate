import { HttpTypes } from "@medusajs/types"

import { getAppointmentProductIds } from "@lib/data/product-kind"
import { getProductPrice } from "@lib/util/get-product-price"
import {
  getProductKind,
  KIND_ACTION_LABEL,
  KIND_TAG,
} from "@lib/util/product-kind"
import Chip from "@modules/common/components/chip"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductCard from "@modules/common/components/product-card"
import ProductCardAction from "@modules/products/components/product-card-action"

const actionClass =
  "inline-flex h-9 min-w-[76px] items-center justify-center rounded-rounded border-[1.5px] border-brand bg-card px-3 text-sm font-extrabold tracking-wide text-brand transition-colors hover:bg-brand-soft"

/**
 * The product card used by every listing (store, categories, collections,
 * home rails, related products, search). It decides what the card offers from
 * how the product is sold: plain products get one-tap ADD, everything else
 * leads to the product page where the real choice is made.
 */
export default async function ProductPreview({
  product,
  region,
}: {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  region: HttpTypes.StoreRegion
}) {
  const countryCode = region.countries?.[0]?.iso_2 ?? ""
  const appointmentIds = await getAppointmentProductIds(
    countryCode,
    region.currency_code
  )
  const kind = getProductKind(product, appointmentIds)
  const { cheapestPrice } = getProductPrice({ product })

  const variants = product.variants ?? []
  const variant = variants[0]
  const href = `/products/${product.handle}`

  const variantTitle =
    variant?.title && !/^default( variant)?$/i.test(variant.title)
      ? variant.title
      : null
  const rentalUnit = (product as { rental_configuration?: { rental_unit?: string } | null })
    .rental_configuration?.rental_unit
  const unitLabel =
    kind === "rent" && rentalUnit
      ? `Per ${rentalUnit}${variants.length > 1 ? ` · ${variants.length} options` : ""}`
      : variants.length > 1
        ? `${variants.length} options`
        : variantTitle

  // Track stock only when the variant manages it and does not allow backorders.
  const tracked =
    kind === "plain" &&
    !!variant?.manage_inventory &&
    !variant?.allow_backorder &&
    typeof variant?.inventory_quantity === "number"
  const stock = tracked ? (variant!.inventory_quantity as number) : undefined

  const action =
    kind === "plain" && !cheapestPrice ? (
      <Chip tone="muted">Unavailable</Chip>
    ) : kind === "plain" && variant ? (
      <ProductCardAction
        variantId={variant.id}
        title={product.title}
        max={stock && stock > 0 ? stock : undefined}
        soldOut={tracked && (stock ?? 0) <= 0}
      />
    ) : kind === "plain" ? null : (
      <LocalizedClientLink
        href={href}
        className={actionClass}
        data-testid="card-select-link"
        aria-label={`${KIND_ACTION_LABEL[kind]} ${product.title}`}
      >
        {KIND_ACTION_LABEL[kind]}
      </LocalizedClientLink>
    )

  return (
    <ProductCard
      data-testid="product-wrapper"
      title={product.title}
      href={href}
      imageUrl={product.thumbnail ?? product.images?.[0]?.url}
      unitLabel={unitLabel}
      amount={cheapestPrice?.calculated_price_number ?? null}
      originalAmount={cheapestPrice?.original_price_number ?? null}
      currencyCode={cheapestPrice?.currency_code ?? null}
      tag={KIND_TAG[kind] ?? null}
      action={action}
    />
  )
}
