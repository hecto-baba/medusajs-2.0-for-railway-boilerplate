import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { TRANSACTION_TYPE_MODULE } from "../../../modules/transaction-type"
import TransactionTypeModuleService from "../../../modules/transaction-type/service"
import { TransactionTypeStatus } from "../../../modules/transaction-type/models/transaction-type"

export type ChangeTransactionTypeStatusStepInput = {
  id: string
  status: TransactionTypeStatus
  /**
   * Supplied by the validation step that ran first, so this step does not
   * re-read the row to discover what it is replacing.
   */
  previous_status: TransactionTypeStatus
}

/**
 * Applies a status change that validateStatusTransitionStep has already
 * cleared. Deactivating and archiving only move this column - the
 * configuration and the history stay exactly as they were.
 */
export const changeTransactionTypeStatusStep = createStep(
  "change-transaction-type-status",
  async (input: ChangeTransactionTypeStatusStepInput, { container }) => {
    const service: TransactionTypeModuleService = container.resolve(
      TRANSACTION_TYPE_MODULE
    )

    const updated = await service.updateTransactionTypes({
      id: input.id,
      status: input.status,
    })

    return new StepResponse(updated, {
      id: input.id,
      status: input.previous_status,
      // What this step actually wrote, so compensation can tell whether the
      // row is still in the state it left it in.
      applied_status: input.status,
    })
  },
  async (compensation, { container }) => {
    if (!compensation) return

    const service: TransactionTypeModuleService = container.resolve(
      TRANSACTION_TYPE_MODULE
    )

    // Only revert if the row still holds what this step wrote. Between the
    // failed run and this compensation, another admin may have legitimately
    // moved the status again - and blindly restoring a snapshot taken at the
    // start of our run would silently undo their acknowledged change, leaving
    // their audit row claiming a state the row no longer has.
    //
    // If it no longer matches, the newer change wins and this one is dropped:
    // reverting someone else's deliberate action is worse than leaving our
    // own rollback incomplete, and the audit trail still records only what
    // actually happened.
    const [current] = await service.listTransactionTypes({
      id: compensation.id,
    })

    if (!current || current.status !== compensation.applied_status) {
      return
    }

    await service.updateTransactionTypes({
      id: compensation.id,
      status: compensation.status,
    })
  }
)
