import { model } from "@medusajs/framework/utils"
import { TransactionType } from "./transaction-type"

export enum TransactionTypeActivityAction {
  CREATED = "created",
  UPDATED = "updated",
  DELETED = "deleted",
  RESTORED = "restored",
  STATUS_CHANGED = "status_changed",
  REORDERED = "reordered",
  IMPORTED = "imported",
}

export const TRANSACTION_TYPE_ACTIVITY_ACTIONS = Object.values(
  TransactionTypeActivityAction
)

/**
 * One recorded change to a transaction type: the audit trail behind the CRUD
 * and status activity views.
 *
 * Note what is deliberately absent - a relation to the admin user who acted.
 * The actor lives in the User module, and Medusa modules cannot hold foreign
 * keys across module boundaries, so the actor is stored as a plain id with
 * the email denormalized alongside it. The denormalization is the point: an
 * audit row has to be able to name who acted even after that user is gone,
 * and a bare id could not.
 */
export const TransactionTypeActivity = model.define(
  "transaction_type_activity",
  {
    id: model.id({ prefix: "txtypeact" }).primaryKey(),
    action: model.enum(TRANSACTION_TYPE_ACTIVITY_ACTIONS),
    actor_id: model.text().nullable(),
    actor_email: model.text().nullable(),
    // Only set for status_changed. Kept as plain text rather than the status
    // enum so that a future rename of a status does not invalidate history
    // that legitimately records the old name.
    previous_status: model.text().nullable(),
    new_status: model.text().nullable(),
    // For updates: the fields that changed, as { field: { from, to } }. Null
    // for actions where a field diff means nothing, such as created.
    changes: model.json().nullable(),
    transaction_type: model.belongsTo(() => TransactionType, {
      mappedBy: "activities",
    }),
  }
)
.indexes([
  // Activities are always read as "the history of one transaction type",
  // newest first.
  {
    on: ["transaction_type_id", "created_at"],
  },
  // Backs the status-activity view, which filters to transitions only.
  {
    on: ["action"],
  },
])
