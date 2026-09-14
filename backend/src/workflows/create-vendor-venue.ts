import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { createRemoteLinkStep, useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { createVenueStep } from "./steps/create-venue"
import { createVenueRowsStep } from "./steps/create-venue-rows"
import { RowType } from "../modules/ticket-booking/models/venue-row"
import { MARKETPLACE_MODULE } from "../modules/marketplace"
import { TICKET_BOOKING_MODULE } from "../modules/ticket-booking"

export type CreateVendorVenueWorkflowInput = {
  vendor_id?: string
  vendor_admin_id?: string
  name: string
  address?: string
  rows: {
    row_number: string
    row_type: RowType
    seat_count: number
  }[]
}

export const createVendorVenueWorkflow = createWorkflow(
  "create-vendor-venue",
  (input: CreateVendorVenueWorkflowInput) => {
    const venue = createVenueStep({
      name: input.name,
      address: input.address,
    })

    const rowsToCreate = transform({ input, venue }, (data) =>
      data.input.rows.map((row) => ({
        ...row,
        venue_id: data.venue.id,
      }))
    )

    createVenueRowsStep({ rows: rowsToCreate })

    const { data: vendorAdmins } = useQueryGraphStep({
      entity: "vendor_admin",
      fields: ["vendor.id"],
      filters: { id: input.vendor_admin_id },
    }).config({ name: "retrieve-vendor-admins" })

    const linkToCreate = transform(
      { input, venue, vendorAdmins },
      (data) => {
        const vendorId =
          data.input.vendor_id || data.vendorAdmins?.[0]?.vendor?.id
        if (!vendorId) {
          throw new Error(
            "Cannot link venue: Authenticated vendor profile does not exist."
          )
        }
        return [
          {
            [MARKETPLACE_MODULE]: {
              vendor_id: vendorId,
            },
            [TICKET_BOOKING_MODULE]: {
              venue_id: data.venue.id,
            },
          },
        ]
      }
    )

    createRemoteLinkStep(linkToCreate)

    const { data: venues } = useQueryGraphStep({
      entity: "venue",
      fields: ["id", "name", "address", "rows.*"],
      filters: { id: venue.id },
    }).config({ name: "retrieve-created-vendor-venue" })

    return new WorkflowResponse({ venue: venues[0] })
  }
)
