import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { cancelOrderWorkflow } from "@medusajs/medusa/core-flows"

export type ValidateTicketOrderStepInput = {
  items: {
    id: string
    variant_id: string
    metadata: Record<string, unknown>
    quantity: number
    variant?: {
      id: string
      product_id: string
      ticket_product_variant?: {
        purchases?: {
          seat_number: string
          show_date: Date
        }[]
      }
    }
  }[]
  order_id: string
}

const sameDay = (a: unknown, b: unknown) => {
  const left = new Date(a as string)
  const right = new Date(b as string)

  if (isNaN(left.valueOf()) || isNaN(right.valueOf())) {
    return false
  }

  return left.toDateString() === right.toDateString()
}

/**
 * Re-checks seat availability at completion time. The add-to-cart hook already
 * rejected taken seats, but a seat can be sold by someone else in the interval
 * between adding it and paying for it.
 *
 * Compensation cancels the order: by the time this runs the cart is already
 * completed, so failing without cancelling would leave a paid order holding
 * seats that were never recorded as purchases.
 */
export const validateTicketOrderStep = createStep(
  "validate-ticket-order",
  async ({ items, order_id }: ValidateTicketOrderStepInput) => {
    const seen = new Set<string>()

    for (const item of items) {
      if (!item.variant?.ticket_product_variant || !item.metadata?.seat_number) {
        continue
      }

      if (item.quantity !== 1) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Ticket line items must have a quantity of 1; line item ${item.id} has ${item.quantity}`
        )
      }

      if (!item.metadata?.show_date) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Show date is required for seat ${item.metadata.seat_number}`
        )
      }

      const key = `${item.variant_id}-${item.metadata.seat_number}-${new Date(
        item.metadata.show_date as string
      ).toDateString()}`

      if (seen.has(key)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Seat ${item.metadata.seat_number} appears more than once in this cart for the same show date`
        )
      }

      seen.add(key)

      const alreadySold = item.variant.ticket_product_variant.purchases?.find(
        (purchase) =>
          purchase?.seat_number === item.metadata.seat_number &&
          sameDay(purchase?.show_date, item.metadata.show_date)
      )

      if (alreadySold) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Seat ${item.metadata.seat_number} has already been purchased for this show date`
        )
      }
    }

    return new StepResponse({ validated: true }, order_id)
  },
  async (order_id, { container, context }) => {
    if (!order_id) return

    await cancelOrderWorkflow(container).run({
      input: { order_id },
      context,
      container,
    })
  }
)
