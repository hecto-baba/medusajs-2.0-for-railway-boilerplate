import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { updateTransactionTypeStep } from "../steps/transaction-type/update-transaction-type"
import { recordTransactionTypeActivityStep } from "../steps/transaction-type/record-transaction-type-activity"
import { TransactionTypeActivityAction } from "../../modules/transaction-type/models/transaction-type-activity"
import { ActivityActor } from "../steps/transaction-type/types"

export type UpdateTransactionTypeWorkflowInput = ActivityActor & {
  id: string
  name?: string
  code?: string
  description?: string | null
  icon_url?: string | null
}

export const updateTransactionTypeWorkflow = createWorkflow(
  "update-transaction-type",
  (input: UpdateTransactionTypeWorkflowInput) => {
    const result = updateTransactionTypeStep({
      id: input.id,
      name: input.name,
      code: input.code,
      description: input.description,
      icon_url: input.icon_url,
    })

    // No activity row when nothing actually moved. A save that changes
    // nothing is not a change, and recording it would bury the real edits in
    // noise. The step reports this by returning a null diff.
    when({ result }, (data) => data.result.changes !== null).then(() => {
      const activityInput = transform({ input, result }, (data) => ({
        transaction_type_id: data.input.id,
        action: TransactionTypeActivityAction.UPDATED,
        actor_id: data.input.actor_id,
        actor_email: data.input.actor_email,
        changes: data.result.changes,
      }))

      recordTransactionTypeActivityStep(activityInput)
    })

    const transactionType = transform(
      { result },
      (data) => data.result.transactionType
    )

    return new WorkflowResponse(transactionType)
  }
)
