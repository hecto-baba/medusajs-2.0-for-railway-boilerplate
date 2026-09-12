import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { updateTransactionTypeRanksStep } from "../steps/transaction-type/update-transaction-type-ranks"
import { recordTransactionTypeActivitiesStep } from "../steps/transaction-type/record-transaction-type-activity"
import { TransactionTypeActivityAction } from "../../modules/transaction-type/models/transaction-type-activity"
import { ActivityActor } from "../steps/transaction-type/types"

export type ReorderTransactionTypesWorkflowInput = ActivityActor & {
  /** The full set in its new order. Position in the array becomes the rank. */
  ids: string[]
}

export const reorderTransactionTypesWorkflow = createWorkflow(
  "reorder-transaction-types",
  (input: ReorderTransactionTypesWorkflowInput) => {
    // Rank is derived from array position rather than sent by the client, so
    // the ordering is always dense and gap-free no matter what the UI sends.
    const ranks = transform({ input }, (data) =>
      data.input.ids.map((id, index) => ({ id, rank: index }))
    )

    const result = updateTransactionTypeRanksStep({ ranks })

    // Only the items whose rank actually changed are recorded. Writing one
    // row per item regardless would mean a single drag in a list of 50 buries
    // the two real moves under 48 rows saying nothing happened - which makes
    // the audit trail harder to read the more it is used.
    const activities = transform({ input, result }, (data) => {
      const previousRanks = new Map(
        (data.result.previous ?? []).map((entry: any) => [entry.id, entry.rank])
      )

      return data.input.ids
        .map((id, index) => ({ id, rank: index }))
        .filter((entry) => previousRanks.get(entry.id) !== entry.rank)
        .map((entry) => ({
          transaction_type_id: entry.id,
          action: TransactionTypeActivityAction.REORDERED,
          actor_id: data.input.actor_id,
          actor_email: data.input.actor_email,
        }))
    })

    recordTransactionTypeActivitiesStep({ activities })

    const transactionTypes = transform({ result }, (data) => data.result.updated)

    return new WorkflowResponse(transactionTypes)
  }
)
