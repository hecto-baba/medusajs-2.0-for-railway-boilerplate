import { TransactionTypeActivityAction } from "../../../modules/transaction-type/models/transaction-type-activity"
import { TransactionTypeStatus } from "../../../modules/transaction-type/models/transaction-type"

/**
 * Who performed an action, carried from the HTTP request into the workflow.
 *
 * Workflows have no request context, so the route reads this off
 * req.auth_context and passes it in explicitly. Both fields are optional
 * because some callers legitimately have no admin user behind them - a seed
 * script or a scheduled job - and an activity row with no actor is better
 * than refusing to record the change at all.
 */
export type ActivityActor = {
  actor_id?: string | null
  actor_email?: string | null
}

/**
 * A field-level diff, recorded on update activities so the audit trail can
 * show what actually changed rather than just that something did.
 */
export type FieldChanges = Record<string, { from: unknown; to: unknown }>

export type RecordActivityInput = ActivityActor & {
  transaction_type_id: string
  action: TransactionTypeActivityAction
  previous_status?: TransactionTypeStatus | string | null
  new_status?: TransactionTypeStatus | string | null
  changes?: FieldChanges | null
}

/** The fields a user can set on a transaction type. */
export type TransactionTypeInput = {
  name: string
  code: string
  description?: string | null
  icon_url?: string | null
  status?: TransactionTypeStatus
  rank?: number
}
