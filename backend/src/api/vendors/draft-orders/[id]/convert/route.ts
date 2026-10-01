import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { convertDraftOrderWorkflow } from "@medusajs/medusa/core-flows"
import { assertVendorOwnsDraftOrder } from "../../helpers"

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const draftOrderId = req.params.id

  await assertVendorOwnsDraftOrder(req, draftOrderId)

  const { result } = await convertDraftOrderWorkflow(req.scope).run({
    input: { id: draftOrderId },
  })

  res.json({ order: result })
}
