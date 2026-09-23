import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { fetchVendorCategories, TrustClawError } from "../../../../lib/trustclaw"

/**
 * GET /admin/taxonomy/vendor-categories
 *
 * Proxies TrustClaw's /api/v1/vendor-categories for the Medusa Admin panel.
 * Forwards status=ALL by default so draft/staged categories are accessible for mapping.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const {
    segmentCode,
    segmentId,
    vendorTypeCode,
    vendorTypeId,
    status = "ALL",
    level,
    parentId,
    pathPrefix,
    hasChildren,
    onboardingMode,
    search,
    tree,
    limit,
  } = req.query as Record<string, string>

  try {
    const vendorCategories = await fetchVendorCategories({
      segmentCode,
      segmentId,
      vendorTypeCode,
      vendorTypeId,
      status,
      level,
      parentId,
      pathPrefix,
      hasChildren,
      onboardingMode,
      search,
      tree,
      limit,
    })

    return res.json({
      vendor_categories: vendorCategories,
      count: vendorCategories.length,
    })
  } catch (err: any) {
    if (err instanceof TrustClawError) {
      return res.status(err.status).json({ message: err.message })
    }
    return res.status(502).json({
      message: "Failed to fetch vendor categories from TrustClaw.",
    })
  }
}
