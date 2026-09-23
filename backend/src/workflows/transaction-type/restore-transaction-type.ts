import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { restoreTransactionTypeStep } from "../steps/transaction-type/restore-transaction-type"
import { recordTransactionTypeActivityStep } from "../steps/transaction-type/record-transaction-type-activity"
import { TransactionTypeActivityAction } from "../../modules/transaction-type/models/transaction-type-activity"
import { ActivityActor } from "../steps/transaction-type/types"

export type RestoreTransactionTypeWorkflowInput = ActivityActor & {
  id: string
}

export const restoreTransactionTypeWorkflow = createWorkflow(
  "restore-transaction-type",
  (input: RestoreTransactionTypeWorkflowInput) => {
    const transactionType = restoreTransactionTypeStep({ id: input.id })

    const activityInput = transform(
      { input, transactionType },
      (data) => ({
        transaction_type_id: data.input.id,
        action: TransactionTypeActivityAction.RESTORED,
        actor_id: data.input.actor_id,
        actor_email: data.input.actor_email,
        // The status it is coming back as, which is whatever it held when it
        // was deleted - restoring does not move it through the lifecycle.
        new_status: data.transactionType.status,
      })
    )

    recordTransactionTypeActivityStep(activityInput)

    return new WorkflowResponse(transactionType)
  }
)
