import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { HttpTypes } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { getOwnedIds } from "../shared/vendor-scope"
import { createVendorRefundReasonWorkflow } from "../../../workflows/create-vendor-refund-reason"

export const GetVendorRefundReasonsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().optional(),
  order: z.string().optional(),
})

/**
 * Lists the calling vendor's refund reasons. Mirrors return-reasons/route.ts
 * exactly - see its comment for the scoping rationale.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { limit, offset, q, order } = req.validatedQuery as unknown as z.infer<
    typeof GetVendorRefundReasonsSchema
  >

  const ownedIds = await getOwnedIds(req, "refund_reasons")

  if (!ownedIds.length) {
    res.json({ refund_reasons: [], count: 0, limit, offset })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const filters: Record<string, any> = { id: ownedIds }
  if (q) {
    filters.$or = [
      { label: { $ilike: `%${q}%` } },
      { code: { $ilike: `%${q}%` } },
      { description: { $ilike: `%${q}%` } },
    ]
  }

  let orderConfig: Record<string, "ASC" | "DESC"> | undefined
  if (order) {
    const isDesc = order.startsWith("-")
    const field = isDesc ? order.slice(1) : order
    orderConfig = { [field]: isDesc ? "DESC" : "ASC" }
  }

  const {
    data: refund_reasons,
    metadata: { count } = { count: 0 },
  } = await query.graph({
    entity: "refund_reason",
    fields: ["id", "label", "code", "description", "created_at", "updated_at"],
    filters,
    pagination: {
      skip: offset,
      take: limit,
      ...(orderConfig ? { order: orderConfig } : {}),
    },
  })

  res.json({ refund_reasons, count, limit, offset })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<HttpTypes.AdminCreateRefundReason>,
  res: MedusaResponse
) => {
  const vendorAdminId = req.auth_context.actor_id

  const { result } = await createVendorRefundReasonWorkflow(req.scope).run({
    input: {
      vendor_admin_id: vendorAdminId,
      data: req.validatedBody,
    },
  })

  res.status(201).json({ refund_reason: result.refund_reason })
}
