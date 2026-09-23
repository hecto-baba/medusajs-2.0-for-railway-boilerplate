import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { importTransactionTypesWorkflow } from "../../../../workflows/transaction-type/import-transaction-types"
import { resolveActor } from "../helpers"

/**
 * Phase one of the import: parse, validate, report - write nothing.
 *
 * The workflow parks itself on a confirmation step and this route returns its
 * transaction id along with the summary, so the admin can see how many rows
 * would be created, how many updated, and which are broken, before anything
 * is committed. Phase two is the confirm route.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const file = (req as any).file

  if (!file) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "No file was uploaded for importing"
    )
  }

  const actor = await resolveActor(req)

  const { result, transaction } = await importTransactionTypesWorkflow(
    req.scope
  ).run({
    input: {
      fileContent: file.buffer.toString("utf-8"),
      filename: file.originalname,
      ...actor,
    },
  })

  // 202: accepted and parsed, but deliberately not applied yet.
  res.status(202).json({
    transaction_id: transaction.transactionId,
    summary: result,
  })
}
