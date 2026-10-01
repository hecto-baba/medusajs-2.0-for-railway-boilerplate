import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { Modules, TransactionHandlerType } from "@medusajs/framework/utils"
import { Delivery } from "../../../modules/delivery/types"
import { handleDeliveryWorkflowId } from "../workflows/handle-delivery"

type SetStepFailedStepInput = { stepId: string; updatedDelivery: Delivery }

export const setStepFailedStep = createStep(
  "set-step-failed-step",
  async function ({ stepId, updatedDelivery }: SetStepFailedStepInput, { container }) {
    const engineService = container.resolve(Modules.WORKFLOW_ENGINE) as any
    await engineService.setStepFailure({
      idempotencyKey: {
        action: TransactionHandlerType.INVOKE,
        transactionId: updatedDelivery.transaction_id || "",
        stepId,
        workflowId: handleDeliveryWorkflowId,
      },
      stepResponse: new StepResponse(updatedDelivery, updatedDelivery.id),
    })
  }
)
