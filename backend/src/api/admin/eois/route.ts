import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * List EOIs. Mirrors ticket-products/route.ts's GET: req.queryConfig is
 * populated by validateAndTransformQuery in middlewares.ts (defaults set
 * there), so no explicit `fields` is set here - per arch-query-config-fields,
 * setting fields alongside req.queryConfig would fight the middleware's
 * own field selection.
 */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve("query")

  const { data: eois, metadata } = await query.graph({
    entity: "eoi",
    ...req.queryConfig,
  })

  res.json({
    eois,
    count: metadata?.count ?? eois.length,
    limit: metadata?.take ?? eois.length,
    offset: metadata?.skip ?? 0,
  })
}
