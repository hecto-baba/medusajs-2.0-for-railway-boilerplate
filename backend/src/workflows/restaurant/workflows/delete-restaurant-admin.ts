import {
  createWorkflow,
  WorkflowResponse,
  WorkflowData,
} from "@medusajs/framework/workflows-sdk"
import { deleteRestaurantAdminStep } from "../steps/delete-restaurant-admin"

export type DeleteRestaurantAdminWorkflow = {
  id: string
}

export const deleteRestaurantAdminWorkflow = createWorkflow(
  "delete-restaurant-admin",
  (
    input: WorkflowData<DeleteRestaurantAdminWorkflow>
  ): WorkflowResponse<string> => {
    deleteRestaurantAdminStep(input)
    return new WorkflowResponse(input.id)
  }
)
