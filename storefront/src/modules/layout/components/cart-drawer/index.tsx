"use client"

import { HttpTypes } from "@medusajs/types"

import {
  isAdjustableLine,
  isPlainLine,
  useCart,
} from "@lib/context/cart-context"
import { getFreeDeliveryThreshold } from "@lib/util/env"
import { convertToLocale } from "@lib/util/money"
import { RequestQuoteButton } from "@modules/cart/components/request-quote-button"
import DiscountCode from "@modules/checkout/components/discount-code"
import BillBreakdown, {
  BillLine,
} from "@modules/common/components/bill-breakdown"
import Drawer from "@modules/common/components/drawer"
import FreeDeliveryBar from "@modules/common/components/free-delivery-bar"
import LineItemAppointmentInfo from "@modules/common/components/line-item-appointment-info"
import LineItemRentalDates from "@modules/common/components/line-item-rental-dates"
import LineItemSeatInfo from "@modules/common/components/line-item-seat-info"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import QtyStepper from "@modules/common/components/qty-stepper"
import { BagIcon } from "@modules/common/icons/ui-icons"
import Thumbnail from "@modules/products/components/thumbnail"

import CartSuggestions from "./suggestions"

type LineItem = HttpTypes.StoreCartLineItem

const CartLine = ({
  item,
  currencyCode,
}: {
  item: LineItem
  currencyCode: string
}) => {
  const cart = useCart()
  const plain = isPlainLine(item)
  const adjustable = isAdjustableLine(item)
  const key = plain && item.variant_id ? item.variant_id : item.id
  const quantity =
    plain && item.variant_id ? cart.quantityFor(item.variant_id) : item.quantity
  const pending = cart.isPending(key)

  // Removed a moment ago: hide it until the server confirms.
  if (quantity <= 0) {
    return null
  }

  const isDeposit = !!item.metadata?.is_rental_deposit
  const isEoi = !!item.metadata?.is_eoi
  const compareAt = (item as { compare_at_unit_price?: number | null })
    .compare_at_unit_price
  const lineTotal = item.unit_price * quantity
  const strike =
    typeof compareAt === "number" && compareAt > item.unit_price
      ? compareAt * quantity
      : null
  const variantTitle =
    item.variant_title && !/^default( variant)?$/i.test(item.variant_title)
      ? item.variant_title
      : null
  const handle = item.product_handle

  return (
    <div
      className="flex items-start gap-3 border-b border-line py-3 last:border-0"
      data-testid="cart-item"
    >
      <div className="w-14 shrink-0">
        {isDeposit ? (
          <div className="grid aspect-square place-items-center rounded-[10px] bg-success-soft text-xs font-bold text-success">
            Deposit
          </div>
        ) : (
          <LocalizedClientLink href={`/products/${handle}`} onClick={cart.closeDrawer}>
            <Thumbnail
              thumbnail={item.thumbnail}
              size="square"
              className="!p-0 !rounded-[10px]"
            />
          </LocalizedClientLink>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {isDeposit ? (
          <span className="text-sm font-bold" data-testid="product-link">
            Security deposit
          </span>
        ) : (
          <LocalizedClientLink
            href={`/products/${handle}`}
            onClick={cart.closeDrawer}
            className="line-clamp-2 text-sm font-bold leading-tight hover:underline"
            data-testid="product-link"
          >
            {item.product_title ?? item.title}
          </LocalizedClientLink>
        )}
        {variantTitle && !isDeposit && (
          <span
            className="block text-xs text-muted"
            data-testid="cart-item-variant"
          >
            {variantTitle}
          </span>
        )}
        {isDeposit && (
          <span className="block text-xs text-muted">
            Refunded after the item is returned
          </span>
        )}
        <div className="text-xs text-muted [&_*]:!text-xs [&_*]:!text-muted">
          <LineItemRentalDates
            metadata={item.metadata}
            data-testid="cart-item-rental-dates"
          />
          <LineItemSeatInfo
            metadata={item.metadata}
            data-testid="cart-item-seat-info"
          />
          <LineItemAppointmentInfo
            metadata={item.metadata}
            showHold
            data-testid="cart-item-appointment-info"
          />
        </div>
        {isEoi && (
          <span className="mt-1 inline-block rounded-soft bg-pop px-1.5 py-0.5 text-[10px] font-bold uppercase text-pop-ink">
            Deposit · balance{" "}
            {convertToLocale({
              amount: Number(item.metadata?.eoi_remaining_amount ?? 0),
              currency_code: currencyCode,
            })}{" "}
            later
          </span>
        )}
        <span
          className="sr-only"
          data-testid="cart-item-quantity"
          data-value={quantity}
        >
          Quantity: {quantity}
        </span>
        {!isDeposit && (
          <button
            type="button"
            onClick={() => cart.removeLine(item)}
            disabled={pending}
            className="mt-1 block text-xs font-semibold text-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-50"
            aria-label={`Remove ${item.product_title ?? item.title} from cart`}
            data-testid="cart-item-remove-button"
          >
            Remove
          </button>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        {adjustable && !isDeposit && (
          <QtyStepper
            quantity={quantity}
            pending={pending}
            label={item.product_title ?? item.title}
            onIncrement={() => cart.incrementLine(item)}
            onDecrement={() => cart.decrementLine(item)}
            data-testid="cart-item-stepper"
          />
        )}
        <span className="text-right text-sm font-bold tabular-nums">
          {strike !== null && (
            <s className="block text-xs font-normal text-muted">
              {convertToLocale({ amount: strike, currency_code: currencyCode })}
            </s>
          )}
          <span data-testid="product-price">
            {convertToLocale({
              amount: lineTotal,
              currency_code: currencyCode,
            })}
          </span>
        </span>
      </div>
    </div>
  )
}

const CartDrawer = () => {
  const { cart, drawerOpen, closeDrawer, itemCount, pendingAdds } = useCart()
  const items = cart?.items ?? []
  const currencyCode = cart?.currency_code ?? ""
  const threshold = getFreeDeliveryThreshold()
  // itemCount includes changes still being saved, so removing the last item
  // shows the empty state immediately instead of an empty card.
  const hasItems = items.length > 0 && itemCount > 0

  const itemSubtotal = Number(cart?.item_subtotal ?? cart?.subtotal ?? 0)
  const discount = Number(cart?.discount_total ?? 0)
  const shipping = Number(cart?.shipping_subtotal ?? cart?.shipping_total ?? 0)
  const tax = Number(cart?.tax_total ?? 0)
  const total = Number(cart?.total ?? 0)

  const deposit = items
    .filter((i) => i.metadata?.is_rental_deposit)
    .reduce((sum, i) => sum + i.unit_price * i.quantity, 0)
  const balanceLater = items
    .filter((i) => i.metadata?.is_eoi)
    .reduce(
      (sum, i) => sum + Number(i.metadata?.eoi_remaining_amount ?? 0) * i.quantity,
      0
    )
  const markdown = items.reduce((sum, i) => {
    const compareAt = (i as { compare_at_unit_price?: number | null })
      .compare_at_unit_price
    return typeof compareAt === "number" && compareAt > i.unit_price
      ? sum + (compareAt - i.unit_price) * i.quantity
      : sum
  }, 0)

  const lines: BillLine[] = [
    { label: "Item total", amount: itemSubtotal, testId: "bill-item-total" },
    ...(deposit > 0
      ? [
          {
            label: "Includes refundable deposit",
            amount: deposit,
            tone: "muted" as const,
          },
        ]
      : []),
    ...(discount > 0
      ? [
          {
            label: "Discount",
            amount: -discount,
            tone: "success" as const,
          },
        ]
      : []),
    shipping > 0
      ? { label: "Delivery", amount: shipping }
      : { label: "Delivery", text: "Calculated at checkout", tone: "muted" },
    ...(tax > 0 ? [{ label: "Taxes", amount: tax }] : []),
  ]

  return (
    <Drawer
      open={drawerOpen}
      onClose={closeDrawer}
      title="My cart"
      data-testid="nav-cart-dropdown"
      footer={
        hasItems ? (
          <div className="grid gap-2.5">
            {pendingAdds > 0 ? (
              <div
                aria-disabled="true"
                role="status"
                className="flex h-14 items-center justify-center gap-3 rounded-large bg-line px-5 font-extrabold text-muted"
                data-testid="checkout-button-saving"
              >
                <span className="h-4 w-4 animate-spin rounded-circle border-2 border-muted border-t-ink" />
                Saving your cart…
              </div>
            ) : (
              <LocalizedClientLink
                href="/checkout"
                onClick={closeDrawer}
                data-testid="checkout-button"
                className="flex h-14 items-center justify-between rounded-large bg-brand px-5 font-extrabold text-brand-ink"
              >
                <span className="flex flex-col leading-tight">
                  <b className="text-base">
                    {convertToLocale({
                      amount: total,
                      currency_code: currencyCode,
                    })}
                  </b>
                  <small className="text-[11px] font-medium opacity-90">
                    ESTIMATED TOTAL
                  </small>
                </span>
                <span>Proceed to checkout ›</span>
              </LocalizedClientLink>
            )}
            <div className="flex items-center justify-between gap-3">
              <LocalizedClientLink
                href="/cart"
                onClick={closeDrawer}
                data-testid="go-to-cart-button"
                className="text-sm font-bold text-brand hover:underline"
              >
                View full cart
              </LocalizedClientLink>
              <div className="min-w-[10rem]">
                <RequestQuoteButton cart={cart ?? undefined} />
              </div>
            </div>
          </div>
        ) : null
      }
    >
      {!hasItems && pendingAdds > 0 ? (
        <div
          className="flex flex-col items-center gap-4 py-16 text-center"
          role="status"
          data-testid="cart-drawer-adding"
        >
          <span className="h-10 w-10 animate-spin rounded-circle border-4 border-line border-t-brand" />
          <span className="text-base font-bold">Adding to your cart…</span>
        </div>
      ) : !hasItems ? (
        <div
          className="flex flex-col items-center gap-4 py-16 text-center"
          data-testid="cart-drawer-empty"
        >
          <span className="grid h-20 w-20 place-items-center rounded-circle bg-card text-muted shadow-lift">
            <BagIcon size={36} />
          </span>
          <span className="text-base font-bold">
            Your shopping bag is empty.
          </span>
          <LocalizedClientLink
            href="/store"
            onClick={closeDrawer}
            className="rounded-rounded bg-brand px-5 py-2.5 text-sm font-bold text-brand-ink"
          >
            <span className="sr-only">Go to all products page</span>
            Explore products
          </LocalizedClientLink>
        </div>
      ) : (
        <div className="grid min-w-0 gap-3 pb-2 [&>*]:min-w-0">
          {pendingAdds > 0 && (
            <div
              className="flex items-center gap-3 rounded-large bg-brand-soft px-4 py-3 text-sm font-bold"
              role="status"
              data-testid="cart-drawer-adding"
            >
              <span className="h-4 w-4 animate-spin rounded-circle border-2 border-line border-t-brand" />
              Adding to your cart…
            </div>
          )}
          {threshold && (
            <FreeDeliveryBar
              subtotal={itemSubtotal}
              threshold={threshold}
              currencyCode={currencyCode}
            />
          )}

          <div className="rounded-large bg-card px-4 py-1 shadow-lift">
            <p className="py-3 text-sm font-bold">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </p>
            <div className="-mt-1">
              {items
                .slice()
                .sort((a, b) =>
                  (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1
                )
                .map((item) => (
                  <CartLine
                    key={item.id}
                    item={item}
                    currencyCode={currencyCode}
                  />
                ))}
            </div>
          </div>

          {!items.some((i) => i.metadata?.restaurant_id) && (
            <CartSuggestions
              excludeProductIds={items
                .map((i) => i.product_id)
                .filter((id): id is string => !!id)}
            />
          )}

          {cart && (
            <div className="rounded-large bg-card px-4 pt-2 shadow-lift">
              <DiscountCode
                cart={
                  cart as HttpTypes.StoreCart & {
                    promotions: HttpTypes.StorePromotion[]
                  }
                }
              />
            </div>
          )}

          <BillBreakdown
            lines={lines}
            total={{ label: "Estimated total", amount: total }}
            currencyCode={currencyCode}
            savings={discount + markdown}
            footerLines={
              balanceLater > 0
                ? [
                    {
                      label: "Balance due later (not charged now)",
                      amount: balanceLater,
                      tone: "muted",
                    },
                  ]
                : undefined
            }
          />
          <span
            className="sr-only"
            data-testid="cart-subtotal"
            data-value={cart?.subtotal ?? 0}
          >
            {convertToLocale({
              amount: Number(cart?.subtotal ?? 0),
              currency_code: currencyCode,
            })}
          </span>
          <p className="px-1 text-xs leading-relaxed text-muted">
            <b className="text-ink">Cancellation policy:</b> orders can be
            cancelled until packing starts. Bookings follow the cancellation
            window shown at booking.
          </p>
        </div>
      )}
    </Drawer>
  )
}

export default CartDrawer
