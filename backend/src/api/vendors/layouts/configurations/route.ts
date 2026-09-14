import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const filters = {
      $or: [
        { user_id: req.auth_context.actor_id },
        { is_system_default: true },
      ],
    }

    const { data: layout_configurations, metadata } = await query.graph({
      entity: "layout_configuration",
      fields: ["id", "zone", "user_id", "configuration", "is_system_default"],
      filters,
      pagination: {
        skip: Number(req.query.offset) || 0,
        take: Math.min(100, Number(req.query.limit) || 20),
      },
    })

    res.json({
      layout_configurations: layout_configurations || [],
      count: metadata?.count ?? layout_configurations?.length ?? 0,
      offset: metadata?.skip ?? 0,
      limit: metadata?.take ?? 20,
    })
  } catch (err: any) {
    res.json({
      layout_configurations: [],
      count: 0,
      offset: 0,
      limit: 20,
    })
  }
}
