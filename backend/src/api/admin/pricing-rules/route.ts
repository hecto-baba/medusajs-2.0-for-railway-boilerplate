import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getService } from "../providers/helpers"

/** Pricing rules for oversight, optionally narrowed to one vendor. Read-only. */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { vendor_id } = req.query as Record<string, string>

  const rules = await getService(req).listPricingRules(
    vendor_id ? { vendor_id } : {},
    { take: null, order: { priority: "DESC", created_at: "ASC" } }
  )

  res.json({ pricing_rules: rules })
}
