import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Cross-vendor oversight queue: every enquiry across every product/vendor,
 * for platform admin only. See docs/plan/PRODUCT_ENQUIRY_MODULE_PLAN_ADMIN.md,
 * Phase boundary - no per-vendor scoping in this phase.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { limit = "20", offset = "0", status } = req.query as Record<string, string>

  const take = Math.max(1, parseInt(limit, 10) || 20)
  const skip = Math.max(0, parseInt(offset, 10) || 0)

  const filters: Record<string, any> = {}
  if (status && ["pending", "responded", "closed"].includes(status)) {
    filters.status = status
  }

  const { data: enquiries, metadata } = await query.graph({
    entity: "enquiry",
    fields: [
      "id",
      "product_id",
      "product.title",
      "customer_id",
      "customer_email",
      "message",
      "reply",
      "status",
      "responded_at",
      "created_at",
    ],
    filters,
    pagination: {
      take,
      skip,
      order: { created_at: "DESC" },
    },
  })

  res.json({
    enquiries,
    count: metadata?.count ?? enquiries.length,
    limit: take,
    offset: skip,
  })
}
