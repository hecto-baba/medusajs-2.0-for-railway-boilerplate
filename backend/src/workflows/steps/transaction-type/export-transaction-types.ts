import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { json2csv } from "json-2-csv"
import { TRANSACTION_TYPE_MODULE } from "../../../modules/transaction-type"
import TransactionTypeModuleService from "../../../modules/transaction-type/service"

export type ExportTransactionTypesStepInput = {
  filters?: Record<string, unknown>
}

/** Export column order, matching the import template so a round trip works. */
const EXPORT_FIELDS = [
  "id",
  "name",
  "code",
  "description",
  "icon_url",
  "status",
  "rank",
  "created_at",
  "updated_at",
] as const

const BATCH_SIZE = 200

/**
 * Dates as ISO 8601 rather than whatever Date.toString() yields on the host.
 * The default is locale and timezone dependent - "Fri Sep 11 2026 14:14:32
 * GMT+0530 (India Standard Time)" - which sorts wrongly in a spreadsheet,
 * differs between servers, and cannot be read back by the import.
 */
const formatValue = (value: unknown): string | number => {
  if (value == null) {
    return ""
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  return value as string | number
}

/**
 * Streams the matching transaction types into a CSV file and returns its key.
 *
 * Written through the File Module's upload stream in batches rather than
 * built in memory, so a large export does not hold the whole table as a
 * string. The same filters the list route uses are honoured, which is what
 * lets an admin export exactly the rows they are looking at.
 */
export const exportTransactionTypesStep = createStep(
  "export-transaction-types",
  async (input: ExportTransactionTypesStepInput, { container }) => {
    const service: TransactionTypeModuleService = container.resolve(
      TRANSACTION_TYPE_MODULE
    )
    const fileModule = container.resolve(Modules.FILE)

    const filename = `${Date.now()}-transaction-types.csv`

    const { writeStream, promise, fileKey, url } =
      await fileModule.getUploadStream({
        filename,
        mimeType: "text/csv",
      })

    // The upload promise can reject long before it is awaited below - an S3
    // failure or a write error surfaces while the paging loop is still
    // running. A promise that rejects with no handler attached is an
    // unhandledRejection, which terminates the process on Node 15+, so a
    // handler is attached here at creation. The settled result is read back
    // through this variable rather than by awaiting the original promise
    // twice.
    let uploadFailure: unknown = null
    const settledUpload = promise.catch((error) => {
      uploadFailure = error
    })

    let skip = 0
    let hasHeader = false
    let exported = 0

    try {
      while (true) {
        const transactionTypes = await service.listTransactionTypes(
          input.filters ?? {},
          {
            select: EXPORT_FIELDS as unknown as string[],
            order: { rank: "ASC" },
            skip,
            take: BATCH_SIZE,
          }
        )

        if (!transactionTypes.length) {
          break
        }

        const batch = json2csv(
          transactionTypes.map((transactionType) =>
            Object.fromEntries(
              EXPORT_FIELDS.map((field) => [
                field,
                formatValue((transactionType as any)[field]),
              ])
            )
          ),
          {
            prependHeader: !hasHeader,
            // A code beginning with = or + would otherwise be run as a
            // formula when the file is opened in a spreadsheet.
            preventCsvInjection: true,
            emptyFieldValue: "",
          }
        )

        const ok = writeStream.write((hasHeader ? "\n" : "") + batch)

        if (!ok) {
          await new Promise((resolve) => writeStream.once("drain", resolve))
        }

        hasHeader = true
        exported += transactionTypes.length

        if (transactionTypes.length < BATCH_SIZE) {
          break
        }

        skip += BATCH_SIZE
      }

      writeStream.end()
      await settledUpload

      if (uploadFailure) {
        throw uploadFailure
      }
    } catch (error) {
      writeStream.destroy()

      // destroy() makes the upload promise reject with the abort. It already
      // has a handler, but the rejection is awaited here so the step does not
      // return while it is still in flight.
      await settledUpload

      throw error
    }

    return new StepResponse({ id: fileKey, filename, url, count: exported }, fileKey)
  },
  async (fileKey, { container }) => {
    if (!fileKey) return

    const fileModule = container.resolve(Modules.FILE)

    await fileModule.deleteFiles(fileKey)
  }
)
