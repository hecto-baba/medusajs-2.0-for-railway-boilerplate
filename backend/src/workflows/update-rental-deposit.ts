import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
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

    return new WorkflowResponse(updatedRental)
  }
)
