import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { fetchSegments, fetchCategories, TrustClawError } from "../../../../lib/trustclaw"

/**
 * GET /vendors/taxonomy/segments
 *
 * Proxy for TrustClaw's /api/v1/segments — returns active business verticals.
 * The TrustClaw API key never leaves the Medusa server.
 *
 * GET /vendors/taxonomy/tc-categories
 *
 * Proxy for TrustClaw's /api/v1/categories — supports drill-down by passing
 * `segmentCode` and `parentId` query parameters.
 * Pass `parentId=null` to get root categories for a segment.
 * Pass `parentId=<uuid>` to get children of a specific category.
 */

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  // Determine which resource was requested from the URL path
  const url = req.url ?? ""
  const isCategories = url.includes("tc-categories")

  try {
    if (isCategories) {
      const { segmentCode, segmentId, parentId, tree, limit } =
        req.query as Record<string, string>

      const categories = await fetchCategories({
        segmentCode,
        segmentId,
        // parentId="null" string means "fetch root categories"
        parentId: parentId ?? undefined,
        tree: tree === "true" ? "true" : undefined,
        limit,
      })

      return res.json({ categories })
    } else {
      const segments = await fetchSegments()
      return res.json({ segments })
    }
  } catch (err: any) {
    if (err instanceof TrustClawError) {
      return res.status(err.status).json({ message: err.message })
    }
    return res.status(502).json({
      message: "Failed to reach TrustClaw API. Please try again.",
    })
  }
}
