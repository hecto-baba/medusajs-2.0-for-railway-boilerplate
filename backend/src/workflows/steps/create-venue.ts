import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { TICKET_BOOKING_MODULE } from "../../modules/ticket-booking"
import TicketBookingModuleService from "../../modules/ticket-booking/service"

export type CreateVenueStepInput = {
  name: string
  address?: string
}

export const createVenueStep = createStep(
  "create-venue",
  async (input: CreateVenueStepInput, { container }) => {
    const service: TicketBookingModuleService = container.resolve(
      TICKET_BOOKING_MODULE
    )

    const venue = await service.createVenues(input)

    return new StepResponse(venue, venue.id)
  },
  async (venueId, { container }) => {
    if (!venueId) return

    const service: TicketBookingModuleService = container.resolve(
      TICKET_BOOKING_MODULE
    )

    await service.deleteVenues([venueId])
  }
)
