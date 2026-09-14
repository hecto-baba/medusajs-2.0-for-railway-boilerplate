import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { TRANSACTION_TYPE_MODULE } from "../../../modules/transaction-type"
import TransactionTypeModuleService from "../../../modules/transaction-type/service"
import { TransactionTypeStatus } from "../../../modules/transaction-type/models/transaction-type"
import { TransactionTypeInput } from "./types"

/**
 * Recognises the unique-index violation on `code` after Medusa's dbErrorMapper
 * has already rewritten it. The mapper turns a Postgres 23505 into an
 * INVALID_DATA MedusaError whose message names the table and column, so the
 * original error code is gone by the time it reaches here.
 */
export const isDuplicateCodeError = (error: unknown): boolean => {
  const message = (error as Error)?.message ?? ""

  return (
    /already exists/i.test(message) && /code/i.test(message)
  ) || (error as { code?: string })?.code === "23505"
}

/**
 * Creates one transaction type.
 *
 * A new type starts as a draft unless the caller asks otherwise, so it can be
 * reviewed before anything is allowed to use it. Only draft and active are
 * accepted here: creating something directly as inactive or archived would
 * mean a type whose history begins in a state it could never have reached by
 * a legal transition.
 */
export const createTransactionTypeStep = createStep(
  "create-transaction-type",
  async (input: TransactionTypeInput, { container }) => {
    const service: TransactionTypeModuleService = container.resolve(
      TRANSACTION_TYPE_MODULE
    )

    const status = input.status ?? TransactionTypeStatus.DRAFT

    if (
      status !== TransactionTypeStatus.DRAFT &&
      status !== TransactionTypeStatus.ACTIVE
    ) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `A transaction type can only be created as "${TransactionTypeStatus.DRAFT}" or "${TransactionTypeStatus.ACTIVE}", not "${status}".`
      )
    }

    // The unique index on code is scoped to deleted_at IS NULL, so a soft
    // deleted type does not block its code being reused. Checking here rather
    // than relying on the constraint alone lets the admin see which field is
    // at fault instead of a raw database error.
    const existing = await service.listTransactionTypes({ code: input.code })

    if (existing.length) {
      throw new MedusaError(
        MedusaError.Types.DUPLICATE_ERROR,
        `A transaction type with the code "${input.code}" already exists.`
      )
    }

    // rank defaults to the end of the list, so a new type never silently
    // displaces the existing order.
    let rank = input.rank

    if (rank === undefined) {
      const [last] = await service.listTransactionTypes(
        {},
        { order: { rank: "DESC" }, take: 1 }
      )

      rank = last ? last.rank + 1 : 0
    }

    // Left as any rather than annotated: createTransactionTypes is overloaded
    // and naming its return type selects the array overload, even though a
    // single object is passed here.
    let transactionType: any

    try {
      transactionType = await service.createTransactionTypes({
        name: input.name,
        code: input.code,
        description: input.description ?? null,
        icon_url: input.icon_url ?? null,
        status,
        rank,
      })
    } catch (error) {
      // The check above is a courtesy, not a guarantee: two concurrent
      // requests can both pass it and only the unique index stops the second.
      // Medusa maps a 23505 to INVALID_DATA (400), while the pre-check throws
      // DUPLICATE_ERROR (422) - so without this the same user action returns
      // a different status depending on whether it raced. Re-throwing as
      // DUPLICATE_ERROR keeps the contract stable.
      if (isDuplicateCodeError(error)) {
        throw new MedusaError(
          MedusaError.Types.DUPLICATE_ERROR,
          `A transaction type with the code "${input.code}" already exists.`
        )
      }

      throw error
    }

    return new StepResponse(transactionType, transactionType.id)
  },
  async (transactionTypeId, { container }) => {
    if (!transactionTypeId) return

    const service: TransactionTypeModuleService = container.resolve(
      TRANSACTION_TYPE_MODULE
    )

    // A hard delete, not a soft one: this row only ever existed inside the
    // failed workflow run, so leaving a soft deleted husk behind would be
    // noise in the table and would hold on to its code.
    await service.deleteTransactionTypes([transactionTypeId])
  }
)
