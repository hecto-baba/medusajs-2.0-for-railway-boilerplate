import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import {
  createRecurringAvailabilityStep,
  CreateRecurringAvailabilityStepInput,
} from "./steps/create-recurring-availability"

export const createRecurringAvailabilityWorkflow = createWorkflow(
  "create-recurring-availability",
  (input: CreateRecurringAvailabilityStepInput) => {
    const rule = createRecurringAvailabilityStep(input)

    return new WorkflowResponse(rule)
  }
)
