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
}

const Item = ({ item, type = "full" }: ItemProps) => {
  const [updating, setUpdating] = useState(false)
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const { handle } = item.variant?.product ?? {}

  const isTicket = isTicketLineItem(item.metadata)
  const [localQty, setLocalQty] = useState<string>(String(item.quantity))

  useEffect(() => {
    setLocalQty(String(item.quantity))
  }, [item.quantity])

  const handleQtyCommit = (val: number) => {
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
      })
      .finally(() => {
        setUpdating(false)
      })
  }

  // TODO: Update this to grab the actual max inventory
  const maxQtyFromInventory = 10
  const maxQuantity = item.variant?.manage_inventory ? 10 : maxQtyFromInventory

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
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white shadow-xs">
                <button
                  type="button"
                  disabled={updating || Number(localQty) <= 1}
                  onClick={() => {
                    const newQty = Math.max(1, Number(localQty) - 1)
                    setLocalQty(String(newQty))
                    handleQtyCommit(newQty)
                  }}
                  className="w-7 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 text-sm font-semibold transition-colors select-none"
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
                  className="w-12 h-8 text-center text-xs font-semibold text-gray-900 border-x border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                  className="w-7 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 text-sm font-semibold transition-colors select-none"
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
