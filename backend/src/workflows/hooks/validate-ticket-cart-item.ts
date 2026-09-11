import { addToCartWorkflow } from "@medusajs/medusa/core-flows"
import { MedusaError } from "@medusajs/framework/utils"

const sameDay = (a: unknown, b: unknown) => {
  const left = new Date(a as string)
  const right = new Date(b as string)

  if (isNaN(left.valueOf()) || isNaN(right.valueOf())) {
    return false
  }

  return left.toDateString() === right.toDateString()
}

/**
 * Rejects a seat that is already sold, or already sitting in this cart.
 *
 * This hook runs for every add-to-cart in the store, not just tickets, so
 * every check below is reached only after the item has been identified as a
 * ticket. In particular the quantity check comes after that guard: the
 * upstream example runs it first, which would reject any ordinary product
 * added with a quantity above one.
 */
addToCartWorkflow.hooks.validate(async ({ input }, { container }) => {
  const items = input.items || []

  const ticketItems = items.filter((item) => item.metadata?.seat_number)

  if (!ticketItems.length) {
    return
  }

  const query = container.resolve("query")

  const { data: productVariants } = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
      "product_id",
      "ticket_product_variant.id",
      "ticket_product_variant.purchases.seat_number",
      "ticket_product_variant.purchases.show_date",
    ],
    filters: {
      id: ticketItems
        .map((item) => item.variant_id)
        .filter(Boolean) as string[],
    },
  })

  const {
    data: [cart],
  } = await query.graph(
    {
      entity: "cart",
      fields: ["id", "items.id", "items.metadata"],
      filters: { id: input.cart_id },
    },
    { throwIfKeyNotFound: true }
  )

  for (const item of ticketItems) {
    const productVariant = productVariants.find(
      (variant) => variant.id === item.variant_id
    )

    // Not a ticket variant after all - the caller sent seat metadata for a
    // product that is not sold as a ticket. Leave it to normal validation.
    if (!productVariant?.ticket_product_variant) {
      continue
    }

    if (item.quantity !== 1) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A ticket covers a single seat, so it must be added with a quantity of 1"
      )
    }

    if (!item.metadata?.show_date) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `A show date is required for seat ${item.metadata?.seat_number}`
      )
    }

    if (!item.metadata?.venue_row_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `A venue row is required for seat ${item.metadata?.seat_number}`
      )
    }

    const alreadySold = productVariant.ticket_product_variant.purchases?.find(
      (purchase) =>
        purchase?.seat_number === item.metadata?.seat_number &&
        sameDay(purchase?.show_date, item.metadata?.show_date)
    )

    if (alreadySold) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Seat ${item.metadata.seat_number} has already been purchased for this show date`
      )
    }

    const alreadyInCart = (cart.items || []).find(
      (cartItem) =>
        cartItem?.metadata?.seat_number === item.metadata?.seat_number &&
        sameDay(cartItem?.metadata?.show_date, item.metadata?.show_date)
    )

    if (alreadyInCart) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Seat ${item.metadata.seat_number} is already in your cart for this show date`
      )
    }
  }
})
