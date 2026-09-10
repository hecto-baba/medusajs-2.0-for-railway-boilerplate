"use client"

import { Button } from "@medusajs/ui"
import { isEqual } from "lodash"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"

import { useIntersection } from "@lib/hooks/use-in-view"
import Divider from "@modules/common/components/divider"
import OptionSelect from "@modules/products/components/product-actions/option-select"

import ErrorMessage from "@modules/checkout/components/error-message"
import MobileActions from "./mobile-actions"
import ProductPrice from "../product-price"
import { addToCart } from "@lib/data/cart"
import { addRentalToCart } from "@lib/data/rentals"
import { HttpTypes } from "@medusajs/types"
import { RentalConfiguration, RentalSelection } from "types/rental"
import RentalDatePicker from "../rental-date-picker"
import { convertToLocale } from "@lib/util/money"

type ProductActionsProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  disabled?: boolean
}

const optionsAsKeymap = (variantOptions: any) => {
  return variantOptions?.reduce((acc: Record<string, string | undefined>, varopt: any) => {
    if (varopt.option && varopt.value !== null && varopt.value !== undefined) {
      acc[varopt.option.title] = varopt.value
    }
    return acc
  }, {})
}

export default function ProductActions({
  product,
  region,
  disabled,
}: ProductActionsProps) {
  const [options, setOptions] = useState<Record<string, string | undefined>>({})
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rentalSelection, setRentalSelection] = useState<RentalSelection | null>(
    null
  )
  const [rentalPrice, setRentalPrice] = useState<number | null>(null)
  const countryCode = useParams().countryCode as string
  const router = useRouter()
  const [, startTransition] = useTransition()

  // If there is only 1 variant, preselect the options
  useEffect(() => {
    if (product.variants?.length === 1) {
      const variantOptions = optionsAsKeymap(product.variants[0].options)
      setOptions(variantOptions ?? {})
    }
  }, [product.variants])

  const selectedVariant = useMemo(() => {
    if (!product.variants || product.variants.length === 0) {
      return
    }

    return product.variants.find((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options])

  // update the options when a variant is selected
  const setOptionValue = (title: string, value: string) => {
    setOptions((prev) => ({
      ...prev,
      [title]: value,
    }))
  }

  // check if the selected variant is in stock
  const inStock = useMemo(() => {
    // If we don't manage inventory, we can always add to cart
    if (selectedVariant && !selectedVariant.manage_inventory) {
      return true
    }

    // If we allow back orders on the variant, we can add to cart
    if (selectedVariant?.allow_backorder) {
      return true
    }

    // If there is inventory available, we can add to cart
    if (
      selectedVariant?.manage_inventory &&
      (selectedVariant?.inventory_quantity || 0) > 0
    ) {
      return true
    }

    // Otherwise, we can't add to cart
    return false
  }, [selectedVariant])

  // The rental configuration arrives on the product through its linked
  // module. A product without an active configuration behaves exactly as
  // before, so the ordinary sale path is untouched.
  const rentalConfiguration = useMemo(() => {
    const config = (product as unknown as {
      rental_configuration?: RentalConfiguration | null
    }).rental_configuration

    return config?.status === "active" ? config : null
  }, [product])

  const isRental = !!rentalConfiguration

  // Availability is per variant, so a dates-and-price pair chosen for one
  // variant must not survive a switch to another. Clearing only on a real
  // change - rather than on every run including the first - keeps this from
  // discarding the answer the picker reports for the newly chosen variant.
  const previousVariantId = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (previousVariantId.current !== selectedVariant?.id) {
      if (previousVariantId.current !== undefined) {
        setRentalSelection(null)
        setRentalPrice(null)
      }

      previousVariantId.current = selectedVariant?.id
    }
  }, [selectedVariant?.id])

  const actionsRef = useRef<HTMLDivElement>(null)

  const inView = useIntersection(actionsRef, "0px")

  // add the selected variant to the cart
  const handleAddToCart = async () => {
    if (!selectedVariant?.id) return null

    setIsAdding(true)
    setError(null)

    try {
      if (isRental) {
        // Guarded by the disabled button below, but a rental must never fall
        // through to the sale path: that would price it as an outright
        // purchase and create no booking.
        if (!rentalSelection) {
          setError("Please choose your rental dates first.")
          return
        }

        await addRentalToCart({
          variantId: selectedVariant.id,
          countryCode,
          rentalStartDate: rentalSelection.rental_start_date,
          rentalEndDate: rentalSelection.rental_end_date,
          rentalDays: rentalSelection.rental_days,
        })
      } else {
        await addToCart({
          variantId: selectedVariant.id,
          quantity: 1,
          countryCode,
        })
      }

      // Belt and braces on top of the scoped cache tag the action revalidates.
      // This was added when the cart was uncached and revalidateTag had nothing
      // to act on, which left the nav badge on the old count after roughly one
      // add in fifteen. The tag now does the work, so this is a second-line
      // guarantee rather than the mechanism.
      startTransition(() => router.refresh())
    } catch (e: any) {
      // Nothing used to catch this. A rejected server action escaped the click
      // handler, so setIsAdding(false) never ran: the button span forever, the
      // cart badge never moved, and the shopper was told nothing at all. A
      // failed add has to be visible.
      setError(
        e?.message ?? "Could not add this item to your cart. Please try again."
      )
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-y-2" ref={actionsRef}>
        <div>
          {(product.variants?.length ?? 0) > 1 && (
            <div className="flex flex-col gap-y-4">
              {(product.options || []).map((option) => {
                return (
                  <div key={option.id}>
                    <OptionSelect
                      option={option}
                      current={options[option.title ?? ""]}
                      updateOption={setOptionValue}
                      title={option.title ?? ""}
                      data-testid="product-options"
                      disabled={!!disabled || isAdding}
                    />
                  </div>
                )
              })}
              <Divider />
            </div>
          )}
        </div>

        <ProductPrice product={product} variant={selectedVariant} />

        {isRental && (
          <>
            <Divider />
            <RentalDatePicker
              productId={product.id}
              variantId={selectedVariant?.id}
              rentalConfiguration={rentalConfiguration}
              currencyCode={region.currency_code}
              disabled={!!disabled || isAdding || !selectedVariant}
              onSelectionChange={setRentalSelection}
              onPriceChange={setRentalPrice}
            />
            {rentalPrice !== null && rentalSelection && (
              <div className="flex items-baseline justify-between">
                <span className="txt-medium text-ui-fg-subtle">
                  Total for {rentalSelection.rental_days}{" "}
                  {rentalSelection.rental_days === 1 ? "day" : "days"}
                </span>
                <span
                  className="text-xl-semi"
                  data-testid="rental-total-price"
                >
                  {convertToLocale({
                    amount: rentalPrice,
                    currency_code: region.currency_code,
                  })}
                </span>
              </div>
            )}
            <Divider />
          </>
        )}

        <Button
          onClick={handleAddToCart}
          disabled={
            !inStock ||
            !selectedVariant ||
            !!disabled ||
            isAdding ||
            (isRental && !rentalSelection)
          }
          variant="primary"
          className="w-full h-10"
          isLoading={isAdding}
          data-testid="add-product-button"
        >
          {!selectedVariant
            ? "Select variant"
            : !inStock
            ? "Out of stock"
            : isRental && !rentalSelection
            ? "Select rental dates"
            : isRental
            ? "Add rental to cart"
            : "Add to cart"}
        </Button>
        <ErrorMessage error={error} data-testid="add-product-error-message" />
        <MobileActions
          product={product}
          variant={selectedVariant}
          options={options}
          updateOptions={setOptionValue}
          inStock={inStock}
          handleAddToCart={handleAddToCart}
          isAdding={isAdding}
          error={error}
          show={!inView}
          optionsDisabled={!!disabled || isAdding}
          isRental={isRental}
          hasRentalSelection={!!rentalSelection}
        />
      </div>
    </>
  )
}
