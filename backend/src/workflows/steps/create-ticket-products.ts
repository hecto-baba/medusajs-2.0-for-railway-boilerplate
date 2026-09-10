import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { TICKET_BOOKING_MODULE } from "../../modules/ticket-booking"
import TicketBookingModuleService from "../../modules/ticket-booking/service"

export type CreateTicketProductsStepInput = {
  ticket_products: {
    product_id: string
    venue_id: string
    dates: string[]
  }[]
}

export const createTicketProductsStep = createStep(
  "create-ticket-products",
  async ({ ticket_products }: CreateTicketProductsStepInput, { container }) => {
    const service: TicketBookingModuleService = container.resolve(
      TICKET_BOOKING_MODULE
    )

    const created = await service.createTicketProducts(ticket_products)

    return new StepResponse(
      created,
      created.map((ticketProduct) => ticketProduct.id)
    )
  },
  async (ids, { container }) => {
    if (!ids?.length) return

    const service: TicketBookingModuleService = container.resolve(
      TICKET_BOOKING_MODULE
    )

    await service.deleteTicketProducts(ids)
  }
)
