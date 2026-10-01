import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { MARKETPLACE_MODULE } from "../../../modules/marketplace"
import { round, toNumber } from "../../../lib/money"

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  vendor_id: z.string().optional(),
  payout_status: z.enum(["owed", "paid", "void"]).optional(),
})

/**
 * Platform-side view of the seller payout ledger (admin only): one row per seller
 * order, with the seller's name, the order number the buyer knows, what is owed
 * after refunds, and totals per currency and status over EVERY matching entry.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { limit, offset, vendor_id, payout_status } = QuerySchema.parse(req.query)
  const marketplace: any = req.scope.resolve(MARKETPLACE_MODULE)
  const query: any = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const filters = {
    ...(vendor_id ? { vendor_id } : {}),
    ...(payout_status ? { payout_status } : {}),
  }

  const [entries, count] = await marketplace.listAndCountVendorOrderSplits(filters, {
    skip: offset,
    take: limit,
    order: { created_at: "DESC" },
  })

  // Names and order numbers for this page only.
  const vendorIds = [...new Set(entries.map((entry: any) => entry.vendor_id))]
  const parentIds = [...new Set(entries.map((entry: any) => entry.parent_order_id))]
  const { data: vendors } = vendorIds.length
    ? await query.graph({ entity: "vendor", fields: ["id", "name"], filters: { id: vendorIds } })
    : { data: [] }
  const { data: parents } = parentIds.length
    ? await query.graph({ entity: "order", fields: ["id", "display_id"], filters: { id: parentIds } })
    : { data: [] }
  const vendorName = new Map<string, string>((vendors as any[]).map((v) => [v.id, v.name]))
  const orderNumber = new Map<string, number>((parents as any[]).map((o) => [o.id, o.display_id]))

  const payouts = entries.map((entry: any) => ({
    ...entry,
    vendor_name: vendorName.get(entry.vendor_id) ?? null,
    order_display_id: orderNumber.get(entry.parent_order_id) ?? null,
    net_total: round(toNumber(entry.total) - toNumber(entry.refunded_total)),
  }))

  const all: any[] = await marketplace.listVendorOrderSplits(filters)
  const totals: Record<string, Record<string, number>> = {}
  for (const row of all) {
    totals[row.currency_code] ??= { owed: 0, paid: 0, void: 0 }
    totals[row.currency_code][row.payout_status] = round(
      (totals[row.currency_code][row.payout_status] ?? 0) + (toNumber(row.total) - toNumber(row.refunded_total))
    )
  }

  res.json({ payouts, count, limit, offset, totals })
}
