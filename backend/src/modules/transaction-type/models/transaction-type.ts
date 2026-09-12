import { model } from "@medusajs/framework/utils"
import { TransactionTypeActivity } from "./transaction-type-activity"

/**
 * The lifecycle a transaction type moves through. Only the transitions in
 * TRANSACTION_TYPE_TRANSITIONS below are legal; archived is terminal.
 */
export enum TransactionTypeStatus {
  DRAFT = "draft",
  ACTIVE = "active",
  INACTIVE = "inactive",
  ARCHIVED = "archived",
}

export const TRANSACTION_TYPE_STATUSES = Object.values(TransactionTypeStatus)

/**
 * Legal status transitions, keyed by the status being moved away from.
 *
 * Deactivating keeps the configuration and its history intact - it only stops
 * the type being used for new transactions - which is why inactive can go back
 * to active. Archived is deliberately terminal: it exists for reference, and
 * reviving one would make the audit trail ambiguous about which configuration
 * a historical transaction actually used.
 */
export const TRANSACTION_TYPE_TRANSITIONS: Record<
  TransactionTypeStatus,
  TransactionTypeStatus[]
> = {
  [TransactionTypeStatus.DRAFT]: [TransactionTypeStatus.ACTIVE],
  [TransactionTypeStatus.ACTIVE]: [TransactionTypeStatus.INACTIVE],
  [TransactionTypeStatus.INACTIVE]: [
    TransactionTypeStatus.ACTIVE,
    TransactionTypeStatus.ARCHIVED,
  ],
  [TransactionTypeStatus.ARCHIVED]: [],
}

/**
 * A kind of transaction the marketplace supports - purchase, refund, rental
 * and so on. Admin-configured rather than hardcoded, so the set can grow
 * without a deploy.
 *
 * name, code and description are searchable, which is what backs free text
 * search on the list route: the `q` parameter matches against every field
 * marked here, as a case-insensitive partial match.
 */
export const TransactionType = model.define("transaction_type", {
  id: model.id({ prefix: "txtype" }).primaryKey(),
  name: model.text().searchable(),
  // Unique so the code can be used as a stable reference from other systems
  // and from the CSV import, which matches rows on it. Medusa scopes the
  // generated unique index to `deleted_at IS NULL`, so soft-deleting a type
  // frees its code for reuse rather than blocking it forever.
  code: model.text().unique().searchable(),
  // searchable() before nullable(): nullable() returns a modifier that ends
  // the builder chain, so the order is not interchangeable.
  description: model.text().searchable().nullable(),
  // Resolved URL of an uploaded file, not a file key: it is rendered directly
  // by the admin list and detail views.
  icon_url: model.text().nullable(),
  status: model
    .enum(TRANSACTION_TYPE_STATUSES)
    .default(TransactionTypeStatus.DRAFT),
  // Controls display order wherever transaction types are listed. Kept as a
  // plain integer rather than a fractional rank: the lists are small enough
  // that rewriting the affected rows on reorder costs nothing.
  rank: model.number().default(0),
  activities: model.hasMany(() => TransactionTypeActivity, {
    mappedBy: "transaction_type",
  }),
})
.indexes([
  // The default list ordering.
  {
    on: ["rank"],
  },
  // Backs the status filter on the list route.
  {
    on: ["status"],
  },
])
