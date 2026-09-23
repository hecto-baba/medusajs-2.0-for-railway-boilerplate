import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { Modules, TransactionHandlerType } from "@medusajs/framework/utils"
import { Delivery } from "../../../modules/delivery/types"
import { handleDeliveryWorkflowId } from "../workflows/handle-delivery"

type SetStepSuccessStepInput = { stepId: string; updatedDelivery: Delivery }

export const setStepSuccessStep = createStep(
  "set-step-success-step",
  async function ({ stepId, updatedDelivery }: SetStepSuccessStepInput, { container }) {
    if (!updatedDelivery?.transaction_id) {
      return new StepResponse(undefined)
    }
    try {
      const engineService = container.resolve(Modules.WORKFLOW_ENGINE) as any
      await engineService.setStepSuccess({
        idempotencyKey: {
          action: TransactionHandlerType.INVOKE,
          transactionId: updatedDelivery.transaction_id,
          stepId,
          workflowId: handleDeliveryWorkflowId,
        },
        stepResponse: new StepResponse(updatedDelivery, updatedDelivery.id),
      })
    } catch (e) {
      console.warn(`Could not set step ${stepId} success on workflow engine:`, e)
    }
    return new StepResponse(undefined)
  }
)
