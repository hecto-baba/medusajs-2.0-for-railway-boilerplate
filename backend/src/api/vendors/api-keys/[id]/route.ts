import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  updateApiKeysWorkflow,
  deleteApiKeysWorkflow,
} from "@medusajs/medusa/core-flows"

export const UpdateVendorApiKeySchema = z.object({
  title: z.string().optional(),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const keyId = req.params.id

  const { data: keys } = await query.graph({
    entity: "api_key",
    fields: [
      "id",
      "title",
      "type",
      "token",
      "redacted",
      "created_at",
      "updated_at",
      "revoked_at",
    ],
    filters: { id: keyId },
  })

  if (!keys?.length) {
    res.status(404).json({ message: "API key not found." })
    return
  }

  res.json({ api_key: keys[0] })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof UpdateVendorApiKeySchema>>,
  res: MedusaResponse
) => {
  const keyId = req.params.id

  const { result } = await updateApiKeysWorkflow(req.scope).run({
    input: {
      selector: { id: keyId },
      update: req.validatedBody as any,
    },
  })

  res.json({ api_key: result[0] })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const keyId = req.params.id

  await deleteApiKeysWorkflow(req.scope).run({
    input: { ids: [keyId] },
  })

  res.json({ id: keyId, object: "api_key", deleted: true })
}
