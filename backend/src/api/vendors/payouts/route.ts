import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { MARKETPLACE_MODULE } from "../../../modules/marketplace"
import { getVendorId } from "../shared/vendor-scope"

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  payout_status: z.enum(["owed", "paid", "void"]).optional(),
})

/**
 * The calling seller's own payout ledger: what the platform owes them, and what
 * it has paid, one entry per order the seller fulfils (decision D2). Scoped on
 * the session's vendor; a seller never sees another seller's entries.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { limit, offset, payout_status } = QuerySchema.parse(req.query)
  const vendorId = await getVendorId(req)
  const marketplace: any = req.scope.resolve(MARKETPLACE_MODULE)

  const filters = { vendor_id: vendorId, ...(payout_status ? { payout_status } : {}) }

  const [entries, count] = await marketplace.listAndCountVendorOrderSplits(filters, {
    skip: offset,
    take: limit,
    order: { created_at: "DESC" },
  })

  // Totals over ALL of the seller's entries, per currency and status (not just this page).
  const all: any[] = await marketplace.listVendorOrderSplits({ vendor_id: vendorId })
  const totals: Record<string, Record<string, number>> = {}
  for (const row of all) {
    totals[row.currency_code] ??= { owed: 0, paid: 0, void: 0, refunded: 0 }
    // Money already returned to buyers on these orders; the seller is owed total minus this.
    totals[row.currency_code].refunded =
      Math.round(((totals[row.currency_code].refunded ?? 0) + Number(row.refunded_total ?? 0)) * 100) / 100
    totals[row.currency_code][row.payout_status] =
      Math.round(((totals[row.currency_code][row.payout_status] ?? 0) + Number(row.total)) * 100) / 100
  }

  res.json({ payouts: entries, count, limit, offset, totals })
}
