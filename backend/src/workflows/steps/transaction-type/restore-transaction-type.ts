import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { TRANSACTION_TYPE_MODULE } from "../../../modules/transaction-type"
import TransactionTypeModuleService from "../../../modules/transaction-type/service"

export type RestoreTransactionTypeStepInput = {
  id: string
}

/**
 * Brings a soft deleted transaction type back into view.
 *
 * The counterpart to softDeleteTransactionTypeStep, and the reason delete was
 * soft in the first place: without this, the row and its history were
 * unreachable through the admin and the choice of a recoverable delete bought
 * nothing.
 */
export const restoreTransactionTypeStep = createStep(
  "restore-transaction-type",
  async (input: RestoreTransactionTypeStepInput, { container }) => {
    const service: TransactionTypeModuleService = container.resolve(
      TRANSACTION_TYPE_MODULE
    )

    // retrieve() excludes soft deleted rows, so the deleted row has to be
    // fetched explicitly with withDeleted before it can be restored.
    const [transactionType] = await service.listTransactionTypes(
      { id: input.id },
      { withDeleted: true }
    )

    if (!transactionType) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Transaction type with id: ${input.id} was not found`
      )
    }

    if (!transactionType.deleted_at) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "This transaction type has not been deleted."
      )
    }

    // The code is only free while the row is deleted - the unique index is
    // scoped to deleted_at IS NULL. If something else claimed it in the
    // meantime, restoring would violate the constraint, so it is caught here
    // to explain why rather than surfacing a raw database error.
    const [claimant] = await service.listTransactionTypes({
      code: transactionType.code,
    })

    if (claimant) {
      throw new MedusaError(
        MedusaError.Types.DUPLICATE_ERROR,
        `The code "${transactionType.code}" is now used by another transaction type, so this one cannot be restored. Change that type's code first.`
      )
    }

    await service.restoreTransactionTypes([input.id])

    return new StepResponse(transactionType, input.id)
  },
  async (transactionTypeId, { container }) => {
    if (!transactionTypeId) return

    const service: TransactionTypeModuleService = container.resolve(
      TRANSACTION_TYPE_MODULE
    )

    await service.softDeleteTransactionTypes([transactionTypeId])
  }
)
