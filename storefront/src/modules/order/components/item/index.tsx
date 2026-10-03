import { HttpTypes } from "@medusajs/types"
import { Table, Text } from "@medusajs/ui"

import LineItemOptions from "@modules/common/components/line-item-options"
import LineItemRentalDates from "@modules/common/components/line-item-rental-dates"
import LineItemSeatInfo from "@modules/common/components/line-item-seat-info"
import LineItemAppointmentInfo from "@modules/common/components/line-item-appointment-info"
import LineItemPrice from "@modules/common/components/line-item-price"
import LineItemUnitPrice from "@modules/common/components/line-item-unit-price"
import Thumbnail from "@modules/products/components/thumbnail"

type ItemProps = {
  item: HttpTypes.StoreCartLineItem | HttpTypes.StoreOrderLineItem
}

const Item = ({ item }: ItemProps) => {
  const isDeposit = !!item.metadata?.is_rental_deposit

  // Same reasoning as the cart row: a deposit line has no catalog
  // product/variant behind it, so it gets a plain row instead of a
  // thumbnail/variant treatment that has nothing real to show.
  if (isDeposit) {
    return (
      <Table.Row className="w-full" data-testid="product-row">
        <Table.Cell className="!pl-0 p-4 w-24" />
        <Table.Cell className="text-left">
          <Text
            className="txt-medium-plus text-ui-fg-base"
            data-testid="product-name"
          >
            Security Deposit
          </Text>
          <Text className="txt-small text-ui-fg-subtle">
            Refundable, held separately from the rental fee.
          </Text>
        </Table.Cell>
        <Table.Cell className="!pr-0">
          <span className="!pr-0 flex flex-col items-end h-full justify-center">
            <LineItemPrice item={item} style="tight" />
          </span>
        </Table.Cell>
      </Table.Row>
    )
  }

  return (
    <Table.Row className="w-full" data-testid="product-row">
      <Table.Cell className="!pl-0 p-4 w-24">
        <div className="flex w-16">
          <Thumbnail thumbnail={item.thumbnail} size="square" />
        </div>
      </Table.Cell>

      <Table.Cell className="text-left">
        <Text
          className="txt-medium-plus text-ui-fg-base"
          data-testid="product-name"
        >
          {item.title}
        </Text>
        {item.variant && (
          <LineItemOptions variant={item.variant} data-testid="product-variant" />
        )}
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
          data-testid="product-appointment-info"
        />
      </Table.Cell>

      <Table.Cell className="!pr-0">
        <span className="!pr-0 flex flex-col items-end h-full justify-center">
          <span className="flex gap-x-1 ">
            <Text className="text-ui-fg-muted">
              <span data-testid="product-quantity">{item.quantity}</span>x{" "}
            </Text>
            <LineItemUnitPrice item={item} style="tight" />
          </span>

          <LineItemPrice item={item} style="tight" />
        </span>
      </Table.Cell>
    </Table.Row>
  )
}

export default Item
