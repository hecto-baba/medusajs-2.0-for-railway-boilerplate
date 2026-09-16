import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { fetchVendorTypes, TrustClawError } from "../../../../lib/trustclaw"

/**
 * GET /admin/taxonomy/vendor-types
 *
 * Proxies TrustClaw's /api/v1/vendor-types for the Medusa Admin panel.
 * Returns vendor transaction types (ORDER, BOOKING, RENTAL, etc.).
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const {
    segmentCode,
    segmentId,
    status,
    isActive,
    search,
    includeCategories,
    limit,
  } = req.query as Record<string, string>

  try {
    const vendorTypes = await fetchVendorTypes({
      segmentCode,
      segmentId,
      status,
      isActive,
      search,
      includeCategories,
      limit,
    })

    return res.json({ vendor_types: vendorTypes, count: vendorTypes.length })
  } catch (err: any) {
    if (err instanceof TrustClawError) {
      return res.status(err.status).json({ message: err.message })
    }
    return res.status(502).json({
      message: "Failed to fetch vendor types from TrustClaw.",
    })
  }
}
