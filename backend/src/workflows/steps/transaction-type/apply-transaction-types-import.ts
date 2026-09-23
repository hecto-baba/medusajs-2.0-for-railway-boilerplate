import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { TRANSACTION_TYPE_MODULE } from "../../../modules/transaction-type"
import TransactionTypeModuleService from "../../../modules/transaction-type/service"
import { ParsedImportRow } from "./parse-transaction-types-csv"

export type ApplyTransactionTypesImportStepInput = {
  rows: ParsedImportRow[]
}

/**
 * Writes the rows an admin confirmed after seeing the import preview.
 *
 * Rows carrying an existing_id update in place; the rest are created. Status
 * is only set on creation - an import should not quietly move a live type
 * back to draft or reactivate one someone deliberately deactivated, and
 * lifecycle moves belong to the transition guard.
 */
export const applyTransactionTypesImportStep = createStep(
  "apply-transaction-types-import",
  async (input: ApplyTransactionTypesImportStepInput, { container }) => {
    if (!input.rows.length) {
      return new StepResponse({ created: [], updated: [] }, null)
    }

    const service: TransactionTypeModuleService = container.resolve(
      TRANSACTION_TYPE_MODULE
    )

    const toCreate = input.rows.filter((row) => !row.existing_id)
    const toUpdate = input.rows.filter((row) => row.existing_id)

    // Captured before writing so compensation can put the updated rows back
    // exactly as they were.
    const previous = toUpdate.length
      ? await service.listTransactionTypes({
          id: toUpdate.map((row) => row.existing_id as string),
        })
      : []

    let created: any[] = []

    if (toCreate.length) {
      const [last] = await service.listTransactionTypes(
        {},
        { order: { rank: "DESC" }, take: 1 }
      )

      let nextRank = last ? last.rank + 1 : 0

      created = await service.createTransactionTypes(
        toCreate.map((row) => ({
          name: row.name,
          code: row.code,
          description: row.description,
          icon_url: row.icon_url,
          status: row.status,
          rank: nextRank++,
        }))
      )
    }

    let updated: any[] = []

    if (toUpdate.length) {
      updated = await service.updateTransactionTypes(
        toUpdate.map((row) => ({
          id: row.existing_id as string,
          name: row.name,
          description: row.description,
          icon_url: row.icon_url,
        }))
      )
    }

    return new StepResponse(
      { created, updated },
      {
        createdIds: created.map((transactionType) => transactionType.id),
        previous: previous.map((transactionType) => ({
          id: transactionType.id,
          name: transactionType.name,
          description: transactionType.description,
          icon_url: transactionType.icon_url,
        })),
      }
    )
  },
  async (compensation, { container }) => {
    if (!compensation) return

    const service: TransactionTypeModuleService = container.resolve(
      TRANSACTION_TYPE_MODULE
    )

    if (compensation.createdIds.length) {
      await service.deleteTransactionTypes(compensation.createdIds)
    }

    if (compensation.previous.length) {
      await service.updateTransactionTypes(compensation.previous)
    }
  }
)
