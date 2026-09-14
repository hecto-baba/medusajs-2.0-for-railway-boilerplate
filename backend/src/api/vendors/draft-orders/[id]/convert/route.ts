import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { convertDraftOrderWorkflow } from "@medusajs/medusa/core-flows"

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const draftOrderId = req.params.id

  const { result } = await convertDraftOrderWorkflow(req.scope).run({
    input: { id: draftOrderId },
  })

  res.json({ order: result })
}
