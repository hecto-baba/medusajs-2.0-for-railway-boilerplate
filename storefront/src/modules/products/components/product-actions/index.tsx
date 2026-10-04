"use client"

import { Button, Text } from "@medusajs/ui"
import dynamic from "next/dynamic"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"

import { useIntersection } from "@lib/hooks/use-in-view"
import Divider from "@modules/common/components/divider"
import OptionSelect from "@modules/products/components/product-actions/option-select"

import ErrorMessage from "@modules/checkout/components/error-message"
import ProductPrice from "../product-price"
import { useCart } from "@lib/context/cart-context"
import { addToCart } from "@lib/data/cart"
import { addEoiToCart } from "@lib/data/eoi"
import { getEoiQuote } from "@lib/util/eoi"
import { getDeliveryEta, getFreeDeliveryThreshold } from "@lib/util/env"
import DeliveryInfo from "./delivery-info"
import QuantityControl from "./quantity-control"
import { addRentalToCart } from "@lib/data/rentals"
import { HttpTypes } from "@medusajs/types"
import { RentalConfiguration, RentalSelection } from "types/rental"
import { convertToLocale } from "@lib/util/money"
import { UNIT_LABEL_PLURAL } from "@lib/util/rental-units"
import { VariantWithDigitalProduct } from "types/global"
import { getDigitalProductPreview } from "@lib/data/digital-products"

type ProductActionsProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  disabled?: boolean
}

// Only rendered for some products / after scrolling, so keep them (and the
// headlessui Dialog, react-day-picker, etc. they pull in) out of the initial
// bundle. Rental and EOI still server-render; the mobile bar is hidden until
// the inline button scrolls out of view, so it renders on the client only.
const RentalDatePicker = dynamic(() => import("../rental-date-picker"))
const EoiOptions = dynamic(() => import("./eoi-options"))
const MobileActions = dynamic(() => import("./mobile-actions"), { ssr: false })

const sameOptions = (
  a: Record<string, string | undefined> | undefined,
  b: Record<string, string | undefined> | undefined
) => {
  const aKeys = Object.keys(a ?? {})
  const bKeys = Object.keys(b ?? {})
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((k) => a![k] === b?.[k])
}

const optionsAsKeymap =(variantOptions: any) => {
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
  const [quantity, setQuantity] = useState<number>(1)
  const [purchaseMode, setPurchaseMode] = useState<"buy" | "eoi">("buy")
  const [isDownloadingPreview, setIsDownloadingPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rentalSelection, setRentalSelection] = useState<RentalSelection | null>(
    null
  )
  // How a rental reaches the renter. Pickup needs no address at checkout, so
  // it is the default; choosing delivery brings back the full address form.
  const [rentalFulfilment, setRentalFulfilment] = useState<
    "pickup" | "delivery"
  >("pickup")
  const [rentalPrice, setRentalPrice] = useState<number | null>(null)
  const [rentalDeposit, setRentalDeposit] = useState<number | null>(null)
  const countryCode = useParams().countryCode as string
  const { trackAdd } = useCart()
  const eta = getDeliveryEta()
  const freeThreshold = getFreeDeliveryThreshold()
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
      return sameOptions(variantOptions, options)
    })
  }, [product.variants, options]) as VariantWithDigitalProduct | undefined

  const handleDownloadPreview = async () => {
    if (!selectedVariant?.digital_product) {
      return
    }

    try {
      setIsDownloadingPreview(true)
      const downloadUrl = await getDigitalProductPreview({
        id: selectedVariant.digital_product.id,
      })

      if (!downloadUrl || !downloadUrl.length) {
        return
      }

      // Trigger direct file download
      try {
        const res = await fetch(downloadUrl)
        if (res.ok) {
          const blob = await res.blob()
          const filename =
            downloadUrl.split("/").pop()?.replace(/^\d+-/, "") || "preview-file"
          const objectUrl = window.URL.createObjectURL(blob)
          const link = document.createElement("a")
          link.href = objectUrl
          link.download = filename
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          window.URL.revokeObjectURL(objectUrl)
          return
        }
      } catch {
        // Fall back to opening directly if fetch fails
      }

      window.open(downloadUrl, "_blank")
    } catch (err) {
      console.error("Error downloading preview:", err)
    } finally {
      setIsDownloadingPreview(false)
    }
  }

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

  // A variant can offer an Expression of Interest: reserve now with a deposit,
  // the balance tracked on the order. Only an active configuration on the
  // selected variant counts; without one the variant sells as usual.
  const eoiQuote = useMemo(() => getEoiQuote(selectedVariant), [selectedVariant])
  const isEoi = !!eoiQuote && purchaseMode === "eoi"

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

  // The seller may allow only one way. Then there is nothing to choose, and the
  // server enforces the same setting, so the form follows it rather than the
  // renter's radio buttons.
  const rentalFulfilmentModes = rentalConfiguration?.fulfilment_modes ?? "both"
  const effectiveRentalFulfilment: "pickup" | "delivery" =
    rentalFulfilmentModes === "both" ? rentalFulfilment : rentalFulfilmentModes

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
        setRentalDeposit(null)
      }

      previousVariantId.current = selectedVariant?.id
    }
  }, [selectedVariant?.id])

  // When a product has a single option (just a size, say), each value maps to
  // exactly one variant, so its price can be shown on the option card.
  const optionHints = useMemo(() => {
    if ((product.options?.length ?? 0) !== 1) return undefined
    const option = product.options![0]
    const hints: Record<string, string> = {}
    for (const value of option.values ?? []) {
      const variant = product.variants?.find((v) =>
        v.options?.some((o: any) => o.option_id === option.id && o.value === value.value)
      )
      const price = variant?.calculated_price
      if (price?.calculated_amount && price.currency_code) {
        hints[value.value] = convertToLocale({
          amount: price.calculated_amount,
          currency_code: price.currency_code,
        })
      }
    }
    return Object.keys(hints).length ? hints : undefined
  }, [product])

  const actionsRef = useRef<HTMLDivElement>(null)

  const inView = useIntersection(actionsRef, "0px")

  // Adding is slow (a few backend calls), so the cart drawer opens and counts
  // the item right away, and rolls back with a message if the add fails.
  const track = <T,>(promise: Promise<T>, quantityAdded = 1) => {
    trackAdd(promise, quantityAdded)
    return promise
  }

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

        await track(addRentalToCart({
          variantId: selectedVariant.id,
          countryCode,
          rentalStartDate: rentalSelection.rental_start_date,
          rentalEndDate: rentalSelection.rental_end_date,
          rentalDays: rentalSelection.rental_days,
          rentalUnit: rentalSelection.rental_unit,
          rentalUnitsCount: rentalSelection.rental_units_count,
          pickupTime: rentalSelection.pickup_time,
          returnTime: rentalSelection.return_time,
          fulfilment: effectiveRentalFulfilment,
        }))
      } else if (isEoi) {
        await track(
          addEoiToCart({ variantId: selectedVariant.id, countryCode }),
          1
        )
      } else {
        const amount = Math.max(1, quantity)
        await track(
          addToCart({
            variantId: selectedVariant.id,
            quantity: amount,
            countryCode,
            isDigital: !!(selectedVariant as VariantWithDigitalProduct)
              .digital_product,
          }),
          amount
        )
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
                      hints={optionHints}
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

        {eoiQuote && !isRental && (
          <EoiOptions
            quote={eoiQuote}
            isEoi={isEoi}
            onChange={setPurchaseMode}
          />
        )}

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
              onDepositChange={setRentalDeposit}
            />
            {rentalFulfilmentModes !== "both" && (
              <Text className="txt-medium text-ui-fg-subtle" data-testid="rental-fulfilment-fixed">
                {rentalFulfilmentModes === "pickup"
                  ? "Pick up from the seller - no delivery address needed."
                  : "Delivered to you - we will ask for your address at checkout."}
              </Text>
            )}
            {rentalFulfilmentModes === "both" && (
            <fieldset
              className="flex flex-col gap-y-2"
              disabled={!!disabled || isAdding}
              data-testid="rental-fulfilment"
            >
              <legend className="txt-medium-plus text-ui-fg-base mb-1">
                How do you want to get it?
              </legend>
              <label className="flex items-start gap-x-2 txt-medium">
                <input
                  type="radio"
                  name="rental_fulfilment"
                  value="pickup"
                  checked={rentalFulfilment === "pickup"}
                  onChange={() => setRentalFulfilment("pickup")}
                  className="mt-1"
                />
                <span>
                  Pick up from the seller
                  <span className="block txt-small text-ui-fg-subtle">
                    No delivery address needed
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-x-2 txt-medium">
                <input
                  type="radio"
                  name="rental_fulfilment"
                  value="delivery"
                  checked={rentalFulfilment === "delivery"}
                  onChange={() => setRentalFulfilment("delivery")}
                  className="mt-1"
                />
                <span>
                  Deliver to me
                  <span className="block txt-small text-ui-fg-subtle">
                    We will ask for your address at checkout
                  </span>
                </span>
              </label>
            </fieldset>
            )}
            {rentalPrice !== null && rentalSelection && (
              <div className="flex flex-col gap-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="txt-medium text-ui-fg-subtle">
                    {rentalSelection.rental_units_count}{" "}
                    {UNIT_LABEL_PLURAL[rentalSelection.rental_unit]}
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
                {!!rentalDeposit && (
                  <div
                    className="flex items-baseline justify-between"
                    data-testid="rental-deposit-line"
                  >
                    <span className="txt-medium text-ui-fg-subtle">
                      Security deposit (refundable)
                    </span>
                    <span className="txt-medium text-ui-fg-base">
                      {convertToLocale({
                        amount: rentalDeposit,
                        currency_code: region.currency_code,
                      })}
                    </span>
                  </div>
                )}
              </div>
            )}
            <Divider />
          </>
        )}

        {selectedVariant?.digital_product && (
          <Button
            onClick={handleDownloadPreview}
            variant="secondary"
            className="w-full h-10 mb-2"
            isLoading={isDownloadingPreview}
          >
            Download Preview
          </Button>
        )}

        {!isRental && !isEoi && (
          <QuantityControl
            quantity={quantity}
            setQuantity={setQuantity}
            disabled={isAdding}
          />
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
          className="h-12 w-full !rounded-large !border-0 !bg-brand !text-base !font-extrabold !text-brand-ink !shadow-none hover:!opacity-90 disabled:!bg-line disabled:!text-muted"
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
            : isEoi
            ? `Reserve for ${convertToLocale({ amount: eoiQuote!.charged, currency_code: eoiQuote!.currencyCode })}`
            : "Add to cart"}
        </Button>
        <ErrorMessage error={error} data-testid="add-product-error-message" />
        {!isRental && (
          <DeliveryInfo
            eta={eta}
            freeThreshold={freeThreshold}
            currencyCode={region.currency_code}
          />
        )}
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
          confirmLabel={
            isEoi
              ? `Reserve for ${convertToLocale({ amount: eoiQuote!.charged, currency_code: eoiQuote!.currencyCode })}`
              : undefined
          }
        />
      </div>
    </>
  )
}
