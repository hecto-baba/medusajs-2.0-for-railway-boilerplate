import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { createVenueStep } from "./steps/create-venue"
import { createVenueRowsStep } from "./steps/create-venue-rows"
import { RowType } from "../modules/ticket-booking/models/venue-row"

export type CreateVenueWorkflowInput = {
  name: string
  address?: string
  rows: {
    row_number: string
    row_type: RowType
    seat_count: number
  }[]
}

export const createVenueWorkflow = createWorkflow(
  "create-venue",
  (input: CreateVenueWorkflowInput) => {
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

    const { data: venues } = useQueryGraphStep({
      entity: "venue",
      fields: ["id", "name", "address", "rows.*"],
      filters: { id: venue.id },
    }).config({ name: "retrieve-created-venue" })

    return new WorkflowResponse({ venue: venues[0] })
  }
)
