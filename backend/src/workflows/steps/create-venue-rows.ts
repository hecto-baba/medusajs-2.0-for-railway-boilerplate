import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { TICKET_BOOKING_MODULE } from "../../modules/ticket-booking"
import TicketBookingModuleService from "../../modules/ticket-booking/service"
import { RowType } from "../../modules/ticket-booking/models/venue-row"

export type CreateVenueRowsStepInput = {
  rows: {
    venue_id: string
    row_number: string
    row_type: RowType
    seat_count: number
  }[]
}

export const createVenueRowsStep = createStep(
  "create-venue-rows",
  async ({ rows }: CreateVenueRowsStepInput, { container }) => {
    const service: TicketBookingModuleService = container.resolve(
      TICKET_BOOKING_MODULE
    )

    const venueRows = await service.createVenueRows(rows)

    return new StepResponse(
      venueRows,
      venueRows.map((row) => row.id)
    )
  },
  async (rowIds, { container }) => {
    if (!rowIds?.length) return

    const service: TicketBookingModuleService = container.resolve(
      TICKET_BOOKING_MODULE
    )

    await service.deleteVenueRows(rowIds)
  }
)
