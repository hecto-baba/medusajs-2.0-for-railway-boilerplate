import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { TransactionTypeStatus } from "../../../../../modules/transaction-type/models/transaction-type"
import { changeTransactionTypeStatusWorkflow } from "../../../../../workflows/transaction-type/change-transaction-type-status"
import { resolveActor } from "../../helpers"

/**
 * Zod validates only that the target is one of the four states. Whether the
 * move is legal from where the type currently sits needs a read of the stored
 * row, so that rule lives in the workflow's transition guard instead - which
 * also means it applies to every caller, not just this route.
 */
export const PostTransactionTypeStatusSchema = z.object({
  status: z.nativeEnum(TransactionTypeStatus),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostTransactionTypeStatusSchema>
  >,
  res: MedusaResponse
) => {
  const actor = await resolveActor(req)

  const { result } = await changeTransactionTypeStatusWorkflow(req.scope).run({
    input: {
      id: req.params.id,
      status: req.validatedBody.status,
      ...actor,
    },
  })

  res.json({ transaction_type: result })
}
