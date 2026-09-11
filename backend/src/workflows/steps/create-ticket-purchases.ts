import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { TICKET_BOOKING_MODULE } from "../../modules/ticket-booking"
import TicketBookingModuleService from "../../modules/ticket-booking/service"
import { DATE_OPTION } from "../create-ticket-product"

export type CreateTicketPurchasesStepInput = {
  order_id: string
  items: {
    id: string
    quantity: number
    metadata: Record<string, unknown> | null
    variant?: {
      id: string
      options?: {
        value: string
        option?: { title: string } | null
      }[] | null
      ticket_product_variant?: {
        id: string
        ticket_product_id: string
      } | null
    } | null
  }[]
}

/**
 * Turns completed ticket line items into TicketPurchase records.
 *
 * The show date comes from the variant's "Date" option, which is the variant's
 * own definition of which performance it sells. Line item metadata is used as
 * a fallback: it is what the shopper actually picked the seat against, and it
 * is set by the ticket line item route, so it stays correct even if a variant
 * option is later renamed.
 */
export const createTicketPurchasesStep = createStep(
  "create-ticket-purchases",
  async ({ order_id, items }: CreateTicketPurchasesStepInput, { container }) => {
    const service: TicketBookingModuleService = container.resolve(
      TICKET_BOOKING_MODULE
    )

    const toCreate = items.flatMap((item) => {
      const ticketVariant = item.variant?.ticket_product_variant

      if (
        !ticketVariant ||
        !item.metadata?.seat_number ||
        !item.metadata?.venue_row_id
      ) {
        return []
      }

      const optionDate = (item.variant?.options || []).find(
        (option) => option.option?.title === DATE_OPTION
      )?.value

      const rawShowDate = optionDate ?? item.metadata?.show_date

      if (!rawShowDate) {
        return []
      }

      const showDate = new Date(rawShowDate as string)

      if (isNaN(showDate.valueOf())) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Line item ${item.id} has an invalid show date: ${rawShowDate}`
        )
      }

      return [
        {
          order_id,
          ticket_product_id: ticketVariant.ticket_product_id,
          ticket_variant_id: ticketVariant.id,
          venue_row_id: item.metadata.venue_row_id as string,
          seat_number: item.metadata.seat_number as string,
          show_date: showDate,
        },
      ]
    })

    if (!toCreate.length) {
      return new StepResponse([], [])
    }

    const purchases = await service.createTicketPurchases(toCreate)

    return new StepResponse(
      purchases,
      purchases.map((purchase) => purchase.id)
    )
  },
  async (ids, { container }) => {
    if (!ids?.length) return

    const service: TicketBookingModuleService = container.resolve(
      TICKET_BOOKING_MODULE
    )

    await service.deleteTicketPurchases(ids)
  }
)
