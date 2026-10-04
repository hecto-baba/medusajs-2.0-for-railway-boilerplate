import { createWorkflow, WorkflowResponse, transform } from "@medusajs/framework/workflows-sdk"
import { emitEventStep } from "@medusajs/medusa/core-flows"
import { updateRentalDepositStep } from "./steps/update-rental-deposit"

type UpdateRentalDepositWorkflowInput = {
  rental_id: string
  status: "refunded" | "partially_refunded" | "forfeited"
}

export const updateRentalDepositWorkflow = createWorkflow(
  "update-rental-deposit",
  ({ rental_id, status }: UpdateRentalDepositWorkflowInput) => {
    const updatedRental = updateRentalDepositStep({
      rental_id,
      status,
    })

    // The renter is emailed from this event (deposit refunded / forfeited).
    emitEventStep({
      eventName: "rental.deposit_changed",
      data: transform({ rental_id, status }, (data) => ({ id: data.rental_id, status: data.status })),
    })

    return new WorkflowResponse(updatedRental)
  }
)
