import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { validateStatusTransitionStep } from "../steps/transaction-type/validate-status-transition"
import { changeTransactionTypeStatusStep } from "../steps/transaction-type/change-transaction-type-status"
import { recordTransactionTypeActivityStep } from "../steps/transaction-type/record-transaction-type-activity"
import { TransactionTypeActivityAction } from "../../modules/transaction-type/models/transaction-type-activity"
import { TransactionTypeStatus } from "../../modules/transaction-type/models/transaction-type"
import { ActivityActor } from "../steps/transaction-type/types"

export type ChangeTransactionTypeStatusWorkflowInput = ActivityActor & {
  id: string
  status: TransactionTypeStatus
}

/**
 * The single path for every lifecycle move - activate, deactivate, archive.
 * They differ only in the target status, so one workflow covers all of them
 * and none can bypass the transition guard.
 */
export const changeTransactionTypeStatusWorkflow = createWorkflow(
  "change-transaction-type-status",
  (input: ChangeTransactionTypeStatusWorkflowInput) => {
    // Throws before anything is written if the move is illegal.
    const validated = validateStatusTransitionStep({
      id: input.id,
      status: input.status,
    })

    const changeInput = transform({ input, validated }, (data) => ({
      id: data.input.id,
      status: data.input.status,
      previous_status: data.validated.previous_status,
    }))

    const transactionType = changeTransactionTypeStatusStep(changeInput)

    const activityInput = transform({ input, validated }, (data) => ({
      transaction_type_id: data.input.id,
      action: TransactionTypeActivityAction.STATUS_CHANGED,
      actor_id: data.input.actor_id,
      actor_email: data.input.actor_email,
      previous_status: data.validated.previous_status,
      new_status: data.input.status,
    }))

    recordTransactionTypeActivityStep(activityInput)

    return new WorkflowResponse(transactionType)
  }
)
