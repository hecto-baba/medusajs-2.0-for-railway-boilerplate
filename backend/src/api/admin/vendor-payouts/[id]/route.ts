import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { MARKETPLACE_MODULE } from "../../../../modules/marketplace"

const BodySchema = z.object({
  payout_status: z.enum(["paid", "void"]),
  payout_reference: z.string().min(1).max(200).optional(),
})

/**
 * Settles a ledger entry: owed -> paid (after the platform paid the seller
 * outside the system; the reference is its bank transfer id) or owed -> void.
 * A paid or void entry is final.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const body = BodySchema.parse(req.body)
  const marketplace: any = req.scope.resolve(MARKETPLACE_MODULE)

  const [entry] = await marketplace.listVendorOrderSplits({ id })
  if (!entry) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Payout entry not found.")
  }
  if (entry.payout_status !== "owed") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `This entry is already ${entry.payout_status} and cannot change.`
    )
  }

  const updated = await marketplace.updateVendorOrderSplits({
    id,
    payout_status: body.payout_status,
    payout_reference: body.payout_reference ?? null,
    paid_at: body.payout_status === "paid" ? new Date() : null,
  })

  res.json({ payout: updated })
}
