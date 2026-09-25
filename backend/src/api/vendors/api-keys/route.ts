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
  order: z.string().optional(),
  created_at_gte: z.string().optional(),
  updated_at_gte: z.string().optional(),
  revoked_at: z.string().optional(),
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
  const {
    limit,
    offset,
    type,
    q,
    order,
    created_at_gte,
    updated_at_gte,
    revoked_at,
  } = req.validatedQuery as unknown as z.infer<typeof GetVendorApiKeysSchema>

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

  const { data: rawApiKeys } = await query.graph({
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
    },
    pagination: {
      skip: 0,
      take: 1000,
    },
  })

  let filtered = (rawApiKeys || []) as any[]

  // Filter by search query (q)
  if (q) {
    const lower = q.toLowerCase()
    filtered = filtered.filter(
      (k: any) =>
        k.title?.toLowerCase().includes(lower) ||
        k.redacted?.toLowerCase().includes(lower) ||
        k.token?.toLowerCase().includes(lower)
    )
  }

  // Filter by created_at_gte
  if (created_at_gte) {
    const gteTime = new Date(created_at_gte).getTime()
    filtered = filtered.filter(
      (k: any) => new Date(k.created_at).getTime() >= gteTime
    )
  }

  // Filter by updated_at_gte
  if (updated_at_gte) {
    const gteTime = new Date(updated_at_gte).getTime()
    filtered = filtered.filter(
      (k: any) => new Date(k.updated_at || k.created_at).getTime() >= gteTime
    )
  }

  // Filter by revoked_at
  if (revoked_at) {
    if (revoked_at === "revoked" || revoked_at === "true") {
      filtered = filtered.filter((k: any) => !!k.revoked_at)
    } else if (revoked_at === "active" || revoked_at === "false") {
      filtered = filtered.filter((k: any) => !k.revoked_at)
    } else {
      const gteTime = new Date(revoked_at).getTime()
      if (!isNaN(gteTime)) {
        filtered = filtered.filter(
          (k: any) => k.revoked_at && new Date(k.revoked_at).getTime() >= gteTime
        )
      }
    }
  }

  // Sort api keys
  // Sort options: Title, Created, Updated, Revoked At, Ascending, Descending
  const sortField = order
    ? order.startsWith("-")
      ? order.slice(1)
      : order
    : "created_at"
  const isDesc = order ? order.startsWith("-") : true

  filtered.sort((a: any, b: any) => {
    let valA = a[sortField]
    let valB = b[sortField]

    if (
      sortField === "created_at" ||
      sortField === "updated_at" ||
      sortField === "revoked_at"
    ) {
      valA = new Date(valA || 0).getTime()
      valB = new Date(valB || 0).getTime()
    } else if (sortField === "title") {
      valA = (valA || "").toLowerCase()
      valB = (valB || "").toLowerCase()
      return isDesc ? valB.localeCompare(valA) : valA.localeCompare(valB)
    }

    if (valA < valB) return isDesc ? 1 : -1
    if (valA > valB) return isDesc ? -1 : 1
    return 0
  })

  const count = filtered.length
  const paginated = filtered.slice(offset, offset + limit)

  res.json({
    api_keys: paginated,
    count,
    limit,
    offset,
  })
}
