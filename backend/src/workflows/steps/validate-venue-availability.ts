import { createStep } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { TICKET_BOOKING_MODULE } from "../../modules/ticket-booking"
import TicketBookingModuleService from "../../modules/ticket-booking/service"

export type ValidateVenueAvailabilityStepInput = {
  venue_id: string
  dates: string[]
}

/**
 * A venue can only host one show per date. Runs before anything is created so
 * a clash fails the workflow before a Product exists.
 */
export const validateVenueAvailabilityStep = createStep(
  "validate-venue-availability",
  async (
    { venue_id, dates }: ValidateVenueAvailabilityStepInput,
    { container }
  ) => {
    const service: TicketBookingModuleService = container.resolve(
      TICKET_BOOKING_MODULE
    )

    const existing = await service.listTicketProducts({ venue_id })

    const requested = dates.map((date) => new Date(date).toDateString())

    for (const ticketProduct of existing) {
      const taken = ((ticketProduct.dates as string[]) || []).map((date) =>
        new Date(date).toDateString()
      )

      const clash = requested.find((date) => taken.includes(date))

      if (clash) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `The venue is already booked on ${clash} by ticket product ${ticketProduct.id}`
        )
      }
    }
  }
)
