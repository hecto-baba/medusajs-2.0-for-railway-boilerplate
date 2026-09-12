import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { softDeleteTransactionTypeStep } from "../steps/transaction-type/soft-delete-transaction-type"
import { recordTransactionTypeActivityStep } from "../steps/transaction-type/record-transaction-type-activity"
import { TransactionTypeActivityAction } from "../../modules/transaction-type/models/transaction-type-activity"
import { ActivityActor } from "../steps/transaction-type/types"

export type DeleteTransactionTypeWorkflowInput = ActivityActor & {
  id: string
}

export const deleteTransactionTypeWorkflow = createWorkflow(
  "delete-transaction-type",
  (input: DeleteTransactionTypeWorkflowInput) => {
    const transactionType = softDeleteTransactionTypeStep({ id: input.id })

    // Recorded after the delete, and deliberately not cascaded away with it:
    // the record of a deletion is the part of the trail most worth keeping.
    const activityInput = transform(
      { input, transactionType },
      (data) => ({
        transaction_type_id: data.input.id,
        action: TransactionTypeActivityAction.DELETED,
        actor_id: data.input.actor_id,
        actor_email: data.input.actor_email,
        // The status it held when it was removed, so the trail explains what
        // was lost rather than just that something was.
        previous_status: data.transactionType.status,
      })
    )

    recordTransactionTypeActivityStep(activityInput)

    return new WorkflowResponse(transactionType)
  }
)
