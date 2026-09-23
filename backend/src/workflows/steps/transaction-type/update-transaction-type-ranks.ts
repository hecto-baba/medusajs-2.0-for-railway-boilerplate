import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { TRANSACTION_TYPE_MODULE } from "../../../modules/transaction-type"
import TransactionTypeModuleService from "../../../modules/transaction-type/service"

export type UpdateTransactionTypeRanksStepInput = {
  ranks: { id: string; rank: number }[]
}

/**
 * Writes a new display order.
 *
 * The caller sends the full ordered set rather than a single moved item: with
 * plain integer ranks, moving one row shifts every row between its old and
 * new position anyway, so recomputing the whole list is both simpler and
 * atomic. The lists here are small enough that the cost is irrelevant.
 *
 * Only rank is touched, so reordering can never alter a name, code,
 * description or status.
 */
export const updateTransactionTypeRanksStep = createStep(
  "update-transaction-type-ranks",
  async (input: UpdateTransactionTypeRanksStepInput, { container }) => {
    if (!input.ranks.length) {
      return new StepResponse(
        { updated: [] as any[], previous: [] as { id: string; rank: number }[] },
        [] as { id: string; rank: number }[]
      )
    }

    const service: TransactionTypeModuleService = container.resolve(
      TRANSACTION_TYPE_MODULE
    )

    const ids = input.ranks.map((entry) => entry.id)
    const existing = await service.listTransactionTypes({ id: ids })

    if (existing.length !== ids.length) {
      const found = new Set(existing.map((transactionType) => transactionType.id))
      const missing = ids.filter((id) => !found.has(id))

      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Unknown transaction type${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`
      )
    }

    // The ranks as they stand before the write, so the workflow can record
    // activity only for the items that actually moved. Plain values rather
    // than entity references: updateTransactionTypes writes through the
    // identity map, and holding references would risk reading back the new
    // ranks instead of the old ones.
    //
    // Note the order here follows the database, not the caller's array - the
    // workflow keys this by id for exactly that reason.
    const previous = existing.map((transactionType) => ({
      id: String(transactionType.id),
      rank: Number(transactionType.rank),
    }))

    const updated = await service.updateTransactionTypes(
      input.ranks.map((entry) => ({ id: entry.id, rank: entry.rank }))
    )

    // Both halves are returned: `updated` is what the route responds with,
    // `previous` is what the activity diff compares against. Returning only
    // the previous ranks would make the endpoint answer with stale ordering.
    return new StepResponse({ updated, previous }, previous)
  },
  async (previousRanks, { container }) => {
    if (!previousRanks?.length) return

    const service: TransactionTypeModuleService = container.resolve(
      TRANSACTION_TYPE_MODULE
    )

    await service.updateTransactionTypes(previousRanks)
  }
)
