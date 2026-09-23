import { createWorkflow, WorkflowData, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { createRestaurantsStep } from "../steps/create-restaurants"

export interface CreateRestaurantWorkflowInput {
  name: string
  handle: string
  phone: string
  email: string
  address: string
  is_open?: boolean
  description?: string | null
  image_url?: string | null
}

export const createRestaurantWorkflow = createWorkflow(
  "create-restaurant-root-workflow",
  (input: WorkflowData<CreateRestaurantWorkflowInput>) => {
    const restaurant = createRestaurantsStep(input)
    return new WorkflowResponse(restaurant)
  }
)
