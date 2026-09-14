import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { exportTransactionTypesWorkflow } from "../../../../workflows/transaction-type/export-transaction-types"

/**
 * Exports the matching transaction types to CSV and returns the file.
 *
 * The same filters the list route accepts are honoured, so an admin exports
 * the rows they are looking at rather than always the whole table. Soft
 * deleted rows are excluded, as they are everywhere else.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  // Same source the list route filters on, so an export matches exactly what
  // the admin is looking at. filterableFields already excludes fields,
  // pagination and ordering, which an export has no use for.
  const { result } = await exportTransactionTypesWorkflow(req.scope).run({
    input: { filters: req.filterableFields ?? {} },
  })

  res.status(200).json({ export: result })
}
