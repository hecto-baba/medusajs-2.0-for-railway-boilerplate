import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { TRANSACTION_TYPE_MODULE } from "../../../modules/transaction-type"
import TransactionTypeModuleService from "../../../modules/transaction-type/service"
import { RecordActivityInput } from "./types"

/**
 * Writes one audit row. Called from every workflow that mutates a transaction
 * type, which is what makes the trail complete regardless of the caller.
 *
 * The compensation deletes the row rather than leaving it: if a later step in
 * the same workflow fails and the write it describes is rolled back, an
 * activity claiming the change happened would be a lie. An audit trail that
 * records events which never occurred is worse than one that misses some.
 */
export const recordTransactionTypeActivityStep = createStep(
  "record-transaction-type-activity",
  async (input: RecordActivityInput, { container }) => {
    const service: TransactionTypeModuleService = container.resolve(
      TRANSACTION_TYPE_MODULE
    )

    const activity = await service.createTransactionTypeActivities({
      transaction_type_id: input.transaction_type_id,
      action: input.action,
      actor_id: input.actor_id ?? null,
      actor_email: input.actor_email ?? null,
      previous_status: input.previous_status ?? null,
      new_status: input.new_status ?? null,
      changes: input.changes ?? null,
    })

    return new StepResponse(activity, activity.id)
  },
  async (activityId, { container }) => {
    if (!activityId) return

    const service: TransactionTypeModuleService = container.resolve(
      TRANSACTION_TYPE_MODULE
    )

    await service.deleteTransactionTypeActivities([activityId])
  }
)

/**
 * The bulk form, used by import and reorder where one workflow run touches
 * many transaction types and a row-per-record trail is still wanted.
 */
export const recordTransactionTypeActivitiesStep = createStep(
  "record-transaction-type-activities",
  async (input: { activities: RecordActivityInput[] }, { container }) => {
    if (!input.activities.length) {
      return new StepResponse([], [])
    }

    const service: TransactionTypeModuleService = container.resolve(
      TRANSACTION_TYPE_MODULE
    )

    const activities = await service.createTransactionTypeActivities(
      input.activities.map((activity) => ({
        transaction_type_id: activity.transaction_type_id,
        action: activity.action,
        actor_id: activity.actor_id ?? null,
        actor_email: activity.actor_email ?? null,
        previous_status: activity.previous_status ?? null,
        new_status: activity.new_status ?? null,
        changes: activity.changes ?? null,
      }))
    )

    return new StepResponse(
      activities,
      activities.map((activity) => activity.id)
    )
  },
  async (activityIds, { container }) => {
    if (!activityIds?.length) return

    const service: TransactionTypeModuleService = container.resolve(
      TRANSACTION_TYPE_MODULE
    )

    await service.deleteTransactionTypeActivities(activityIds)
  }
)
