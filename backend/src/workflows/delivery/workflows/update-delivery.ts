import { createWorkflow, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { UpdateDelivery } from "../../../modules/delivery/types"
import { updateDeliveryStep } from "../steps/update-delivery"
import { setStepSuccessStep } from "../steps/set-step-success"
import { setStepFailedStep } from "../steps/set-step-failed"

export type WorkflowInput = {
  data: UpdateDelivery
  stepIdToSucceed?: string
  stepIdToFail?: string
}

export const updateDeliveryWorkflow = createWorkflow(
  "update-delivery-workflow",
  function (input: WorkflowInput) {
    const updatedDelivery = updateDeliveryStep({ data: input.data })
    when(input, ({ stepIdToSucceed }) => stepIdToSucceed !== undefined).then(() => {
      setStepSuccessStep({ stepId: input.stepIdToSucceed!, updatedDelivery })
    })
    when(input, ({ stepIdToFail }) => stepIdToFail !== undefined).then(() => {
      setStepFailedStep({ stepId: input.stepIdToFail!, updatedDelivery })
    })
    return new WorkflowResponse(updatedDelivery)
  }
)
