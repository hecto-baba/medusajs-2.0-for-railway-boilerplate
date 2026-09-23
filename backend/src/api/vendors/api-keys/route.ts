import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createVendorApiKeyWorkflow } from "../../../workflows/create-vendor-api-key"

export const GetVendorApiKeysSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  type: z.enum(["publishable", "secret"]).optional(),
  q: z.string().optional(),
})

export const CreateVendorApiKeySchema = z.object({
  title: z.string().min(1),
  type: z.enum(["publishable", "secret"]).default("publishable"),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof CreateVendorApiKeySchema>>,
  res: MedusaResponse
) => {
  const { title, type } = req.validatedBody

  const { result } = await createVendorApiKeyWorkflow(req.scope).run({
    input: {
      vendor_admin_id: req.auth_context.actor_id,
      api_key: {
        title,
        type: type as any,
        created_by: req.auth_context.actor_id,
      },
    },
  })

  res.status(201).json({ api_key: result.api_key })
}

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { limit, offset, type, q } = req.validatedQuery as unknown as z.infer<
    typeof GetVendorApiKeysSchema
  >

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.id", "vendor.api_keys.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  const vendorKeyIds = (vendorAdmin?.vendor?.api_keys || [])
    .map((k: any) => k?.id)
    .filter(Boolean)

  if (!vendorKeyIds.length) {
    res.json({ api_keys: [], count: 0, limit, offset })
    return
  }

  const { data: apiKeys, metadata } = await query.graph({
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
    filters: {
      id: vendorKeyIds,
      ...(type ? { type } : {}),
      ...(q ? { title: { $ilike: `%${q}%` } } : {}),
    },
    pagination: {
      skip: offset,
      take: limit,
      order: { created_at: "DESC" },
    },
  })

  res.json({
    api_keys: apiKeys,
    count: metadata?.count ?? apiKeys.length,
    limit,
    offset,
  })
}
