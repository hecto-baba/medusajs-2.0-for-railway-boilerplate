import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { TRANSACTION_TYPE_MODULE } from "../../../modules/transaction-type"
import TransactionTypeModuleService from "../../../modules/transaction-type/service"
import { isDuplicateCodeError } from "./create-transaction-type"
import { FieldChanges } from "./types"

export type UpdateTransactionTypeStepInput = {
  id: string
  name?: string
  code?: string
  description?: string | null
  icon_url?: string | null
}

/** Fields this step is allowed to change. Status and rank have their own steps. */
const EDITABLE_FIELDS = [
  "name",
  "code",
  "description",
  "icon_url",
] as const

/**
 * Updates the editable fields of a transaction type and reports what changed.
 *
 * Status is deliberately not updatable here - it goes through the transition
 * guard instead - and neither is rank, which the reorder workflow owns. That
 * keeps every lifecycle move and every ordering change attributable to a
 * step that validates it.
 *
 * The returned diff is what the update activity records, so the audit trail
 * shows the fields that actually moved rather than the whole payload.
 */
export const updateTransactionTypeStep = createStep(
  "update-transaction-type",
  async (input: UpdateTransactionTypeStepInput, { container }) => {
    const service: TransactionTypeModuleService = container.resolve(
      TRANSACTION_TYPE_MODULE
    )

    const existing = await service.retrieveTransactionType(input.id)

    if (input.code && input.code !== existing.code) {
      const clash = await service.listTransactionTypes({ code: input.code })

      if (clash.length) {
        throw new MedusaError(
          MedusaError.Types.DUPLICATE_ERROR,
          `A transaction type with the code "${input.code}" already exists.`
        )
      }
    }

    const changes: FieldChanges = {}

    for (const field of EDITABLE_FIELDS) {
      if (input[field] === undefined) {
        continue
      }

      const next = input[field] ?? null
      const current = existing[field] ?? null

      if (next !== current) {
        changes[field] = { from: current, to: next }
      }
    }

    // Nothing actually moved. Returning early keeps updated_at untouched and
    // stops the workflow recording an activity with an empty diff.
    if (!Object.keys(changes).length) {
      return new StepResponse({ transactionType: existing, changes: null }, null)
    }

    // Inferred, not annotated: updateTransactionTypes is overloaded and
    // naming its return type selects the array overload.
    let updated: any

    try {
      updated = await service.updateTransactionTypes({
        id: input.id,
        ...Object.fromEntries(
          Object.entries(changes).map(([field, change]) => [field, change.to])
        ),
      })
    } catch (error) {
      // Same race as on create: the clash check above can be passed by two
      // concurrent requests, and only the unique index stops the second. Keep
      // the status code the same whether or not the request raced.
      if (isDuplicateCodeError(error)) {
        throw new MedusaError(
          MedusaError.Types.DUPLICATE_ERROR,
          `A transaction type with the code "${input.code}" already exists.`
        )
      }

      throw error
    }

    return new StepResponse(
      { transactionType: updated, changes },
      // Only the previous values of the fields this step touched, so
      // compensation cannot clobber a concurrent change to another field.
      {
        id: input.id,
        previous: Object.fromEntries(
          Object.entries(changes).map(([field, change]) => [field, change.from])
        ),
      }
    )
  },
  async (compensation, { container }) => {
    if (!compensation) return

    const service: TransactionTypeModuleService = container.resolve(
      TRANSACTION_TYPE_MODULE
    )

    await service.updateTransactionTypes({
      id: compensation.id,
      ...compensation.previous,
    })
  }
)
