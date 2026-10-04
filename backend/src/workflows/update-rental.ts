import { createWorkflow, WorkflowResponse, transform } from "@medusajs/framework/workflows-sdk"
import { emitEventStep } from "@medusajs/medusa/core-flows"
import { updateRentalStep } from "./steps/update-rental"

type UpdateRentalWorkflowInput = {
  rental_id: string
  status: "active" | "returned" | "cancelled"
}

export const updateRentalWorkflow = createWorkflow(
  "update-rental",
  ({ rental_id, status }: UpdateRentalWorkflowInput) => {
    // Update rental status
    const updatedRental = updateRentalStep({
      rental_id,
      status,
    })

    // The renter is emailed from this event (activated / returned).
    emitEventStep({
      eventName: "rental.status_changed",
      data: transform({ rental_id, status }, (data) => ({ id: data.rental_id, status: data.status })),
    })

    return new WorkflowResponse(updatedRental)
  }
)

