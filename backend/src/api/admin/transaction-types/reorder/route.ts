import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { reorderTransactionTypesWorkflow } from "../../../../workflows/transaction-type/reorder-transaction-types"
import { resolveActor } from "../helpers"

/**
 * The client sends the full set in its intended order and the server derives
 * the ranks from array position. Sending positions rather than rank numbers
 * keeps the ordering dense however the UI chooses to present the move.
 */
export const PostTransactionTypesReorderSchema = z.object({
  ids: z
    .array(z.string().min(1))
    .min(1, "At least one transaction type is required")
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "The same transaction type cannot appear twice",
    }),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostTransactionTypesReorderSchema>
  >,
  res: MedusaResponse
) => {
  const actor = await resolveActor(req)

  const { result } = await reorderTransactionTypesWorkflow(req.scope).run({
    input: { ids: req.validatedBody.ids, ...actor },
  })

  res.json({ transaction_types: result })
}
