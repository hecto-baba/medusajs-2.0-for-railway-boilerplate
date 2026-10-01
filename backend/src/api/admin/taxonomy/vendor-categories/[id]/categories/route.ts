import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  fetchVendorCategoryCategories,
  TrustClawError,
} from "../../../../../../lib/trustclaw"

/**
 * GET /admin/taxonomy/vendor-categories/:id/categories
 *
 * Proxies TrustClaw's /api/v1/vendor-categories/[id]/categories (P2V mapping).
 * Returns the product categories allowed for a particular vendor store type.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const { parentId } = req.query as Record<string, string>

  try {
    const mappedCategories = await fetchVendorCategoryCategories(id, {
      parentId,
    })

    return res.json({
      categories: mappedCategories,
      count: mappedCategories.length,
    })
  } catch (err: any) {
    if (err instanceof TrustClawError) {
      return res.status(err.status).json({ message: err.message })
    }
    return res.status(502).json({
      message: "Failed to fetch mapped categories from TrustClaw.",
    })
  }
}
