import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { fetchCategories, TrustClawError } from "../../../../lib/trustclaw"

/**
 * GET /vendors/taxonomy/tc-categories
 *
 * Proxies TrustClaw's /api/v1/categories.
 * The TrustClaw API key never leaves the Medusa server.
 *
 * Query parameters (all optional):
 *   segmentCode  - e.g. "AGRICULTURE"
 *   parentId     - "null" → root categories; "<uuid>" → children of that node
 *   tree         - "true" to get full nested tree (used only by sync job)
 *   limit        - default 200
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const {
    segmentCode,
    segmentId,
    parentId,
    level,
    hasChildren,
    vendorCategoryId,
    pathPrefix,
    search,
    tree,
    limit,
  } = req.query as Record<string, string>

  try {
    const categories = await fetchCategories({
      segmentCode,
      segmentId,
      parentId: parentId ?? undefined,
      level,
      hasChildren,
      vendorCategoryId,
      pathPrefix,
      search,
      tree: tree === "true" ? "true" : undefined,
      limit,
    })

    // Resolve Medusa category IDs for the returned TrustClaw categories
    try {
      const productModuleService = req.scope.resolve(Modules.PRODUCT)
      if (categories && categories.length > 0) {
        const medusaCats = await productModuleService.listProductCategories(
          {},
          { select: ["id", "metadata"] as any, take: 10_000 }
        )
        const tcToMedusa = new Map<string, string>()
        for (const mc of medusaCats) {
          const tcId = (mc.metadata as any)?.trustclaw_id
          if (tcId) tcToMedusa.set(tcId, mc.id)
        }
        for (const cat of categories) {
          ;(cat as any).medusa_id = tcToMedusa.get(cat.id) ?? null
        }
      }
    } catch {
      // Non-fatal if Medusa category ID lookup fails
    }

    return res.json({ categories })
  } catch (err: any) {
    if (err instanceof TrustClawError) {
      return res.status(err.status).json({ message: err.message })
    }
    return res.status(502).json({
      message: "Failed to reach TrustClaw API. Please try again.",
    })
  }
}
