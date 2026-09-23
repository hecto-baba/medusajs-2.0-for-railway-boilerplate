import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { csv2json } from "json-2-csv"
import { TRANSACTION_TYPE_MODULE } from "../../../modules/transaction-type"
import TransactionTypeModuleService from "../../../modules/transaction-type/service"
import {
  TransactionTypeStatus,
  TRANSACTION_TYPE_STATUSES,
} from "../../../modules/transaction-type/models/transaction-type"

export type ParseTransactionTypesCsvStepInput = {
  fileContent: string
  filename: string
}

export type ImportRowError = {
  /** 1-based row number as the admin sees it in their spreadsheet, header included. */
  row: number
  message: string
}

export type ParsedImportRow = {
  row: number
  name: string
  code: string
  description: string | null
  icon_url: string | null
  status: TransactionTypeStatus
  /** Set when the code already exists, meaning this row updates rather than creates. */
  existing_id: string | null
}

export type ImportSummary = {
  filename: string
  to_create: number
  to_update: number
  errors: ImportRowError[]
  rows: ParsedImportRow[]
}

/** The template columns. name and code are required; the rest are optional. */
export const IMPORT_COLUMNS = [
  "name",
  "code",
  "description",
  "icon_url",
  "status",
] as const

const normalize = (value: unknown): string =>
  typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim()

/**
 * Parses and validates an uploaded CSV without writing anything.
 *
 * Validation happens entirely here so the confirmation screen can show the
 * admin exactly what will happen - how many rows create, how many update, and
 * which rows are broken - before a single write. A file with any invalid row
 * is still reported in full rather than failing on the first problem, because
 * fixing a spreadsheet one error per upload would be miserable.
 *
 * Read-only, so there is nothing to compensate.
 */
export const parseTransactionTypesCsvStep = createStep(
  "parse-transaction-types-csv",
  async (input: ParseTransactionTypesCsvStepInput, { container }) => {
    const service: TransactionTypeModuleService = container.resolve(
      TRANSACTION_TYPE_MODULE
    )

    let parsed: Record<string, unknown>[]

    try {
      parsed = csv2json(input.fileContent, { trimHeaderFields: true }) as Record<
        string,
        unknown
      >[]
    } catch (error) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Could not read "${input.filename}" as CSV. ${(error as Error).message}`
      )
    }

    if (!parsed.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `"${input.filename}" has no rows.`
      )
    }

    const errors: ImportRowError[] = []
    const rows: ParsedImportRow[] = []
    // Codes seen in this file, so a duplicate inside the upload itself is
    // caught here rather than by the unique index halfway through writing.
    const seenCodes = new Map<string, number>()

    const codes = parsed
      .map((entry) => normalize(entry.code).toUpperCase())
      .filter(Boolean)

    const existingByCode = new Map<string, string>()

    if (codes.length) {
      const existing = await service.listTransactionTypes({ code: codes })

      for (const transactionType of existing) {
        existingByCode.set(transactionType.code, transactionType.id)
      }
    }

    parsed.forEach((entry, index) => {
      // +2: one for the header line, one because spreadsheets are 1-based.
      const row = index + 2

      const name = normalize(entry.name)
      const code = normalize(entry.code).toUpperCase()
      const status = normalize(entry.status).toLowerCase()

      if (!name) {
        errors.push({ row, message: "name is required" })
        return
      }

      if (!code) {
        errors.push({ row, message: "code is required" })
        return
      }

      const duplicateOf = seenCodes.get(code)

      if (duplicateOf) {
        errors.push({
          row,
          message: `code "${code}" is already used on row ${duplicateOf} of this file`,
        })
        return
      }

      if (status && !TRANSACTION_TYPE_STATUSES.includes(status as TransactionTypeStatus)) {
        errors.push({
          row,
          message: `status "${status}" is not one of ${TRANSACTION_TYPE_STATUSES.join(", ")}`,
        })
        return
      }

      // Imports may only produce draft or active types, for the same reason
      // creation may: the other states are reachable only by a transition.
      if (
        status &&
        status !== TransactionTypeStatus.DRAFT &&
        status !== TransactionTypeStatus.ACTIVE
      ) {
        errors.push({
          row,
          message: `status "${status}" cannot be set by import - use "${TransactionTypeStatus.DRAFT}" or "${TransactionTypeStatus.ACTIVE}"`,
        })
        return
      }

      seenCodes.set(code, row)

      const description = normalize(entry.description)
      const iconUrl = normalize(entry.icon_url)

      rows.push({
        row,
        name,
        code,
        description: description || null,
        icon_url: iconUrl || null,
        status: (status as TransactionTypeStatus) || TransactionTypeStatus.DRAFT,
        existing_id: existingByCode.get(code) ?? null,
      })
    })

    const summary: ImportSummary = {
      filename: input.filename,
      to_create: rows.filter((row) => !row.existing_id).length,
      to_update: rows.filter((row) => row.existing_id).length,
      errors,
      rows,
    }

    return new StepResponse(summary)
  }
)
