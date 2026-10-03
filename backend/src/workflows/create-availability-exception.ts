import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import {
  createAvailabilityExceptionStep,
  CreateAvailabilityExceptionStepInput,
} from "./steps/create-availability-exception"

export const createAvailabilityExceptionWorkflow = createWorkflow(
  "create-availability-exception",
  (input: CreateAvailabilityExceptionStepInput) => {
    const exception = createAvailabilityExceptionStep(input)

    return new WorkflowResponse(exception)
  }
)
