import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { restoreTransactionTypeWorkflow } from "../../../../../workflows/transaction-type/restore-transaction-type"
import { resolveActor } from "../../helpers"

/**
 * Undoes a soft delete.
 *
 * Takes no body: restoring returns the type exactly as it was, including the
 * status it held when it was deleted. Moving it somewhere else afterwards is
 * a separate, audited lifecycle change.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const actor = await resolveActor(req)

  const { result } = await restoreTransactionTypeWorkflow(req.scope).run({
    input: { id: req.params.id, ...actor },
  })

  res.json({ transaction_type: result })
}
