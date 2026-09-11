import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { TICKET_BOOKING_MODULE } from "../../modules/ticket-booking"
import TicketBookingModuleService from "../../modules/ticket-booking/service"

export type UpdateTicketPurchaseStatusStepInput = {
  ticket_purchase_id: string
  status: "pending" | "scanned"
}

export const updateTicketPurchaseStatusStep = createStep(
  "update-ticket-purchase-status",
  async (
    { ticket_purchase_id, status }: UpdateTicketPurchaseStatusStepInput,
    { container }
  ) => {
    const service: TicketBookingModuleService = container.resolve(
      TICKET_BOOKING_MODULE
    )

    const current = await service.retrieveTicketPurchase(ticket_purchase_id)

    const updated = await service.updateTicketPurchases({
      id: ticket_purchase_id,
      status,
    })

    return new StepResponse(updated, {
      id: ticket_purchase_id,
      previousStatus: current.status,
    })
  },
  async (compensationData, { container }) => {
    if (!compensationData) return

    const service: TicketBookingModuleService = container.resolve(
      TICKET_BOOKING_MODULE
    )

    await service.updateTicketPurchases({
      id: compensationData.id,
      status: compensationData.previousStatus,
    })
  }
)
