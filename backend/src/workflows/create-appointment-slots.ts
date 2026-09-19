import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import {
  createAppointmentSlotsStep,
  CreateAppointmentSlotsStepInput,
} from "./steps/create-appointment-slots"

export const createAppointmentSlotsWorkflow = createWorkflow(
  "create-appointment-slots",
  (input: CreateAppointmentSlotsStepInput) => {
    const appointments = createAppointmentSlotsStep(input)

    return new WorkflowResponse(appointments)
  }
)
