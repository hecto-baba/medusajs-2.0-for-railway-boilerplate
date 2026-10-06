"use client"

import { Table, Text, clx } from "@medusajs/ui"

import { updateLineItem } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import CartItemSelect from "@modules/cart/components/cart-item-select"
import ErrorMessage from "@modules/checkout/components/error-message"
import DeleteButton from "@modules/common/components/delete-button"
import LineItemOptions from "@modules/common/components/line-item-options"
import LineItemRentalDates from "@modules/common/components/line-item-rental-dates"
import LineItemSeatInfo from "@modules/common/components/line-item-seat-info"
import LineItemAppointmentInfo from "@modules/common/components/line-item-appointment-info"
import { isAppointmentLineItem } from "types/appointment"
import { isTicketLineItem } from "types/ticket"
import LineItemPrice from "@modules/common/components/line-item-price"
import LineItemUnitPrice from "@modules/common/components/line-item-unit-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Spinner from "@modules/common/icons/spinner"
import Thumbnail from "@modules/products/components/thumbnail"
import { useRouter } from "next/navigation"
import { useState, useEffect, useTransition } from "react"

type ItemProps = {
  item: HttpTypes.StoreCartLineItem
  type?: "full" | "preview"
  currencyCode?: string
}

const Item = ({ item, type = "full", currencyCode }: ItemProps) => {
  const [updating, setUpdating] = useState(false)
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const { handle } = item.variant?.product ?? {}

  // A ticket is one seat and an appointment is one booking: neither has a
  // quantity to choose (the backend fixes both at 1).
  const isTicket =
    isTicketLineItem(item.metadata) || isAppointmentLineItem(item.metadata)
  const isDeposit = !!item.metadata?.is_rental_deposit

  const [localQty, setLocalQty] = useState<string>(String(item.quantity))

  useEffect(() => {
    setLocalQty(String(item.quantity))
  }, [item.quantity])

  const handleQtyCommit = (val: number) => {
    // Enter then blur both commit; ignore the second while the first is in flight.
    if (updating) return
    if (isNaN(val) || val < 1) {
      setLocalQty(String(item.quantity))
      return
    }
    if (val !== item.quantity) {
      changeQuantity(val)
    }
  }

  const changeQuantity = async (quantity: number) => {
    setError(null)
    setUpdating(true)

    await updateLineItem({
      lineId: item.id,
      quantity,
    })
      .then(() => {
        // Belt and braces on top of the scoped cache tag the action
        // revalidates. See the note in product-actions.
        startTransition(() => router.refresh())
      })
      .catch((err) => {
        setError(err.message)
        // The update was rejected, so item.quantity never changes and the
        // effect above won't resync the box - put the real value back.
        setLocalQty(String(item.quantity))
      })
      .finally(() => {
        setUpdating(false)
      })
  }

  // TODO: Update this to grab the actual max inventory
  const maxQtyFromInventory = 10
  const maxQuantity = item.variant?.manage_inventory ? 10 : maxQtyFromInventory

  // The deposit has no catalog product/variant behind it (it's a manual line
  // item added alongside the rental), so it gets a plain, distinct row
  // instead of the thumbnail/quantity-selector treatment a real product gets.
  // Empty cells (rather than colSpan, which @medusajs/ui's Table.Cell doesn't
  // type) keep the column count identical to a normal row.
  if (isDeposit) {
    return (
      <Table.Row className="w-full" data-testid="product-row">
        <Table.Cell className="!pl-0 p-4 w-24" />
        <Table.Cell className="text-left">
          <Text
            className="txt-medium-plus text-ui-fg-base"
            data-testid="product-title"
          >
            Security Deposit
          </Text>
          <Text className="txt-small text-ui-fg-subtle">
            Refundable, held separately from the rental fee.
          </Text>
        </Table.Cell>
        {type === "full" && <Table.Cell />}
        {type === "full" && <Table.Cell className="hidden small:table-cell" />}
        <Table.Cell className="!pr-0">
          <span className="!pr-0 flex flex-col items-end h-full justify-center">
            <LineItemPrice
              item={item}
              style="tight"
              currencyCode={currencyCode}
            />
          </span>
        </Table.Cell>
      </Table.Row>
    )
  }

  return (
    <Table.Row className="w-full" data-testid="product-row">
      <Table.Cell className="!pl-0 p-4 w-24">
        <LocalizedClientLink
          href={`/products/${handle}`}
          className={clx("flex", {
            "w-16": type === "preview",
            "small:w-24 w-12": type === "full",
          })}
        >
          <Thumbnail
            thumbnail={item.variant?.product?.thumbnail}
            images={item.variant?.product?.images}
            size="square"
          />
        </LocalizedClientLink>
      </Table.Cell>

      <Table.Cell className="text-left">
        <Text
          className="txt-medium-plus text-ui-fg-base"
          data-testid="product-title"
        >
          {item.product_title}
        </Text>
        <LineItemOptions variant={item.variant} data-testid="product-variant" />
        <LineItemRentalDates
          metadata={item.metadata}
          data-testid="product-rental-dates"
        />
        <LineItemSeatInfo
          metadata={item.metadata}
          data-testid="product-seat-info"
        />
        <LineItemAppointmentInfo
          metadata={item.metadata}
          showHold={type === "full"}
          data-testid="product-appointment-info"
        />
        {typeof item.metadata?.restaurant_name === "string" && (
          <Text className="txt-compact-xsmall text-ui-fg-subtle mt-0.5">
            Restaurant: {String(item.metadata.restaurant_name)}
          </Text>
        )}
      </Table.Cell>

      {type === "full" && (
        <Table.Cell>
          <div className="flex gap-2 items-center w-28">
            <DeleteButton id={item.id} data-testid="product-delete-button" />
            {/* A ticket is one seat, so there is no quantity to choose. The
                backend rejects any ticket line with a quantity other than 1. */}
            {isTicket ? (
              <Text className="text-ui-fg-subtle">1</Text>
            ) : (
              <div className="flex items-center border border-line rounded-lg overflow-hidden bg-card shadow-xs">
                <button
                  type="button"
                  disabled={updating || Number(localQty) <= 1}
                  onClick={() => {
                    const newQty = Math.max(1, Number(localQty) - 1)
                    setLocalQty(String(newQty))
                    handleQtyCommit(newQty)
                  }}
                  className="w-7 h-8 flex items-center justify-center text-muted hover:bg-canvas disabled:opacity-30 text-sm font-semibold transition-colors select-none"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  value={localQty}
                  disabled={updating}
                  onChange={(e) => setLocalQty(e.target.value)}
                  onBlur={() => handleQtyCommit(parseInt(localQty))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleQtyCommit(parseInt(localQty))
                    }
                  }}
                  className="w-12 h-8 text-center text-xs font-semibold text-ink border-x border-line focus:outline-none focus:ring-1 focus:ring-brand [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  data-testid="product-quantity-input"
                  aria-label="Quantity"
                />
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => {
                    const newQty = (Number(localQty) || 0) + 1
                    setLocalQty(String(newQty))
                    handleQtyCommit(newQty)
                  }}
                  className="w-7 h-8 flex items-center justify-center text-muted hover:bg-canvas disabled:opacity-30 text-sm font-semibold transition-colors select-none"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            )}
            {updating && <Spinner />}
          </div>
          <ErrorMessage error={error} data-testid="product-error-message" />
        </Table.Cell>
      )}

      {type === "full" && (
        <Table.Cell className="hidden small:table-cell">
          <LineItemUnitPrice item={item} style="tight" />
        </Table.Cell>
      )}

      <Table.Cell className="!pr-0">
        <span
          className={clx("!pr-0", {
            "flex flex-col items-end h-full justify-center": type === "preview",
          })}
        >
          {type === "preview" && (
            <span className="flex gap-x-1 ">
              <Text className="text-ui-fg-muted">{item.quantity}x </Text>
              <LineItemUnitPrice item={item} style="tight" />
            </span>
          )}
          <LineItemPrice item={item} style="tight" />
        </span>
      </Table.Cell>
    </Table.Row>
  )
}

export default Item
