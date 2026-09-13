import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { HttpTypes } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { getOwnedIds } from "../shared/vendor-scope"
import { createVendorReturnReasonWorkflow } from "../../../workflows/create-vendor-return-reason"

export const GetVendorReturnReasonsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

/**
 * Lists the calling vendor's return reasons, paginated.
 *
 * Scoped through the vendor's link rows rather than a request field - see
 * PRODUCTS.md §6, rule 1. An empty catalogue short-circuits (rule 3) rather
 * than falling through to an unfiltered query, which would list every return
 * reason in the store.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { limit, offset } = req.validatedQuery as unknown as z.infer<
    typeof GetVendorReturnReasonsSchema
  >

  const ownedIds = await getOwnedIds(req, "return_reasons")

  if (!ownedIds.length) {
    res.json({ return_reasons: [], count: 0, limit, offset })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: return_reasons,
    metadata: { count } = { count: 0 },
  } = await query.graph({
    entity: "return_reason",
    fields: ["id", "value", "label", "description", "created_at", "updated_at"],
    filters: { id: ownedIds },
    pagination: { skip: offset, take: limit },
  })

  res.json({ return_reasons, count, limit, offset })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<HttpTypes.AdminCreateReturnReason>,
  res: MedusaResponse
) => {
  const vendorAdminId = req.auth_context.actor_id

  const { result } = await createVendorReturnReasonWorkflow(req.scope).run({
    input: {
      vendor_admin_id: vendorAdminId,
      data: req.validatedBody,
    },
  })

  res.status(201).json({ return_reason: result.return_reason })
}
