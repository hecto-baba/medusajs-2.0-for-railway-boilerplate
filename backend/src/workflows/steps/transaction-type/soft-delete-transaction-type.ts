import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { TRANSACTION_TYPE_MODULE } from "../../../modules/transaction-type"
import TransactionTypeModuleService from "../../../modules/transaction-type/service"

export type SoftDeleteTransactionTypeStepInput = {
  id: string
}

/**
 * Removes a transaction type from the admin's view without destroying it.
 *
 * Soft rather than hard for two reasons: the activity rows that describe it
 * have to outlive it, and a hard delete would take the record of its own
 * deletion with it. The unique index on code is scoped to deleted_at IS NULL,
 * so the code becomes available again straight away.
 */
export const softDeleteTransactionTypeStep = createStep(
  "soft-delete-transaction-type",
  async (input: SoftDeleteTransactionTypeStepInput, { container }) => {
    const service: TransactionTypeModuleService = container.resolve(
      TRANSACTION_TYPE_MODULE
    )

    // Retrieved first so the step fails cleanly on an unknown id rather than
    // silently soft deleting nothing.
    const transactionType = await service.retrieveTransactionType(input.id)

    await service.softDeleteTransactionTypes([input.id])

    return new StepResponse(transactionType, input.id)
  },
  async (transactionTypeId, { container }) => {
    if (!transactionTypeId) return

    const service: TransactionTypeModuleService = container.resolve(
      TRANSACTION_TYPE_MODULE
    )

    await service.restoreTransactionTypes([transactionTypeId])
  }
)
