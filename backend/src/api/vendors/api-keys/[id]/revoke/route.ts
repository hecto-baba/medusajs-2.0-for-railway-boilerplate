import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { revokeApiKeysWorkflow } from "@medusajs/medusa/core-flows"
import { assertVendorOwns } from "../../../shared/vendor-scope"

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const keyId = req.params.id

  await assertVendorOwns(req, "api_keys", keyId, "API key not found.")

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
