import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { customerRejectQuoteWorkflow } from "../../../../../../../workflows/customer-reject-quote"

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { result } = await customerRejectQuoteWorkflow(req.scope).run({
    input: {
      quote_id: req.params.id,
      customer_id: req.auth_context.actor_id,
    },
  })

  return res.json(result || { success: true })
}
