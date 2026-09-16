import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { fetchSegments, TrustClawError } from "../../../../lib/trustclaw"

/**
 * GET /admin/taxonomy/segments
 *
 * Fetches all business segments from TrustClaw API for the Medusa Admin panel.
 */
export const GET = async (
  _req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const segments = await fetchSegments()
    return res.json({ segments, count: segments.length })
  } catch (err: any) {
    if (err instanceof TrustClawError) {
      return res.status(err.status).json({ message: err.message })
    }
    return res.status(502).json({
      message: "Failed to fetch segments from TrustClaw. Please check API key and URL.",
    })
  }
}
