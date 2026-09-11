import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { TICKET_BOOKING_MODULE } from "../../modules/ticket-booking"
import TicketBookingModuleService from "../../modules/ticket-booking/service"

export type VerifyTicketPurchaseStepInput = {
  ticket_purchase_id: string
}

export const verifyTicketPurchaseStep = createStep(
  "verify-ticket-purchase",
  async (
    { ticket_purchase_id }: VerifyTicketPurchaseStepInput,
    { container }
  ) => {
    const service: TicketBookingModuleService = container.resolve(
      TICKET_BOOKING_MODULE
    )

    const ticketPurchase = await service.retrieveTicketPurchase(
      ticket_purchase_id
    )

    if (ticketPurchase.status !== "pending") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "This ticket has already been scanned"
      )
    }

    // Compared by calendar day: a show that started an hour ago should still
    // admit a latecomer, but yesterday's ticket should not.
    const showDay = new Date(ticketPurchase.show_date)
    showDay.setHours(23, 59, 59, 999)

    if (showDay < new Date()) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "This ticket has expired; the show date has passed"
      )
    }

    return new StepResponse(true)
  }
)
