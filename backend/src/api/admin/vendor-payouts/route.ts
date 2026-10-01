import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { MARKETPLACE_MODULE } from "../../../modules/marketplace"

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  vendor_id: z.string().optional(),
  payout_status: z.enum(["owed", "paid", "void"]).optional(),
})

/** Platform-side view of the seller payout ledger (admin only). */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { limit, offset, vendor_id, payout_status } = QuerySchema.parse(req.query)
  const marketplace: any = req.scope.resolve(MARKETPLACE_MODULE)

  const [payouts, count] = await marketplace.listAndCountVendorOrderSplits(
    { ...(vendor_id ? { vendor_id } : {}), ...(payout_status ? { payout_status } : {}) },
    { skip: offset, take: limit, order: { created_at: "DESC" } }
  )

  res.json({ payouts, count, limit, offset })
}
