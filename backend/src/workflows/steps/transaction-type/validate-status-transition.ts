import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { TRANSACTION_TYPE_MODULE } from "../../../modules/transaction-type"
import TransactionTypeModuleService from "../../../modules/transaction-type/service"
import {
  TransactionTypeStatus,
  TRANSACTION_TYPE_TRANSITIONS,
} from "../../../modules/transaction-type/models/transaction-type"

export type ValidateStatusTransitionInput = {
  id: string
  status: TransactionTypeStatus
}

/**
 * Rejects an illegal lifecycle move before anything is written.
 *
 * This lives in a step rather than in the route's Zod schema because the rule
 * depends on the current stored status, which needs a read. Keeping it here
 * also means it holds for every caller - the admin UI, a CSV import, or a
 * future workflow - rather than only for requests that happen to come through
 * one route.
 *
 * Read-only, so there is nothing to compensate.
 */
export const validateStatusTransitionStep = createStep(
  "validate-transaction-type-status-transition",
  async (input: ValidateStatusTransitionInput, { container }) => {
    const service: TransactionTypeModuleService = container.resolve(
      TRANSACTION_TYPE_MODULE
    )

    const transactionType = await service.retrieveTransactionType(input.id)
    const current = transactionType.status as TransactionTypeStatus

    if (current === input.status) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `This transaction type is already "${current}".`
      )
    }

    const allowed = TRANSACTION_TYPE_TRANSITIONS[current] ?? []

    if (!allowed.includes(input.status)) {
      const detail = allowed.length
        ? `It can only move to ${allowed.map((s) => `"${s}"`).join(" or ")}.`
        : `"${current}" is a final state.`

      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `A transaction type cannot move from "${current}" to "${input.status}". ${detail}`
      )
    }

    return new StepResponse({
      transactionType,
      previous_status: current,
    })
  }
)
