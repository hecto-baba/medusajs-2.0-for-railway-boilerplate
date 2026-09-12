import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { createTransactionTypeStep } from "../steps/transaction-type/create-transaction-type"
import { recordTransactionTypeActivityStep } from "../steps/transaction-type/record-transaction-type-activity"
import { TransactionTypeActivityAction } from "../../modules/transaction-type/models/transaction-type-activity"
import { ActivityActor, TransactionTypeInput } from "../steps/transaction-type/types"

export type CreateTransactionTypeWorkflowInput = TransactionTypeInput &
  ActivityActor

export const createTransactionTypeWorkflow = createWorkflow(
  "create-transaction-type",
  (input: CreateTransactionTypeWorkflowInput) => {
    const transactionType = createTransactionTypeStep({
      name: input.name,
      code: input.code,
      description: input.description,
      icon_url: input.icon_url,
      status: input.status,
      rank: input.rank,
    })

    const activityInput = transform(
      { input, transactionType },
      (data) => ({
        transaction_type_id: data.transactionType.id,
        action: TransactionTypeActivityAction.CREATED,
        actor_id: data.input.actor_id,
        actor_email: data.input.actor_email,
        // A created type has no prior status, so only the landing state is
        // recorded. This is what lets the status activity view show the
        // lifecycle from its very first entry rather than starting at the
        // first transition.
        new_status: data.transactionType.status,
      })
    )

    recordTransactionTypeActivityStep(activityInput)

    return new WorkflowResponse(transactionType)
  }
)
