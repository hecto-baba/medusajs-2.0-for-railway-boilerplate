import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { limit = "15", offset = "0", q } = req.query as Record<string, string>

  const take = Math.max(1, parseInt(limit, 10) || 15)
  const skip = Math.max(0, parseInt(offset, 10) || 0)

  const filters: Record<string, any> = {}
  if (q && typeof q === "string" && q.trim()) {
    filters.$or = [
      { name: { $ilike: `%${q.trim()}%` } },
      { handle: { $ilike: `%${q.trim()}%` } },
    ]
  }

  const { data: vendors, metadata } = await query.graph({
    entity: "vendor",
    fields: [
      "id",
      "name",
      "handle",
      "logo",
      "created_at",
      "updated_at",
      "admins.*",
      "products.*",
      "products.variants.*",
    ],
    filters,
    pagination: {
      take,
      skip,
      order: { created_at: "DESC" },
    },
  })

  res.json({
    vendors,
    count: metadata?.count ?? vendors.length,
    limit: take,
    offset: skip,
  })
}
