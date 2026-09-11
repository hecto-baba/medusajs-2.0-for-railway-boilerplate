import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { TICKET_BOOKING_MODULE } from "../../modules/ticket-booking"
import TicketBookingModuleService from "../../modules/ticket-booking/service"
import { RowType } from "../../modules/ticket-booking/models/venue-row"

export type CreateTicketProductVariantsStepInput = {
  variants: {
    ticket_product_id: string
    product_variant_id: string
    row_type: RowType
  }[]
}

export const createTicketProductVariantsStep = createStep(
  "create-ticket-product-variants",
  async (
    { variants }: CreateTicketProductVariantsStepInput,
    { container }
  ) => {
    const service: TicketBookingModuleService = container.resolve(
      TICKET_BOOKING_MODULE
    )

    const created = await service.createTicketProductVariants(variants)

    return new StepResponse(
      created,
      created.map((variant) => variant.id)
    )
  },
  async (ids, { container }) => {
    if (!ids?.length) return

    const service: TicketBookingModuleService = container.resolve(
      TICKET_BOOKING_MODULE
    )

    await service.deleteTicketProductVariants(ids)
  }
)
