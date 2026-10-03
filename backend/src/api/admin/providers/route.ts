import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { limit = "15", offset = "0", q } = req.query as Record<string, string>

  const take = Math.max(1, parseInt(limit, 10) || 15)
  const skip = Math.max(0, parseInt(offset, 10) || 0)

  const filters: Record<string, any> = {}
  if (q && typeof q === "string" && q.trim()) {
    filters.$or = [
      { display_name: { $ilike: `%${q.trim()}%` } },
    ]
  }

  const { data: providers, metadata } = await query.graph({
    entity: "provider",
    fields: [
      "id",
      "display_name",
      "timezone",
      "status",
      "vendor_admin.email",
      "vendor_admin.first_name",
      "vendor_admin.last_name",
    ],
    filters,
    pagination: {
      take,
      skip,
      order: { id: "DESC" },
    },
  })

  res.json({
    providers,
    count: metadata?.count ?? providers.length,
    limit: take,
    offset: skip,
  })
}
