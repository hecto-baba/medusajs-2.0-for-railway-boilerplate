import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { cancelAppointmentStep, CancelAppointmentStepInput } from "./steps/cancel-appointment"

export const cancelAppointmentWorkflow = createWorkflow(
  "cancel-appointment",
  (input: CancelAppointmentStepInput) => {
    const result = cancelAppointmentStep(input)

    return new WorkflowResponse(result)
  }
)
