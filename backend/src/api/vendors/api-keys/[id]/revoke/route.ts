import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { revokeApiKeysWorkflow } from "@medusajs/medusa/core-flows"

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const keyId = req.params.id

  const { result } = await revokeApiKeysWorkflow(req.scope).run({
    input: {
      selector: { id: keyId },
      revoke: {
        revoked_by: req.auth_context.actor_id,
      },
    },
  })

  res.json({ api_key: result[0] })
}
