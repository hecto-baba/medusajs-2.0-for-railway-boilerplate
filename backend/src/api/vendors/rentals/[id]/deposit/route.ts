import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { updateRentalDepositWorkflow } from "../../../../../workflows/update-rental-deposit"
import { assertVendorOwnsRental } from "../../helpers"

/**
 * Mirrors /admin/rentals/:id/deposit - same workflow, same status enum, but
 * scoped to rentals booked on the calling vendor's own orders via
 * assertVendorOwnsRental. Vendors get the same deposit authority as admin
 * (mark refunded/partially refunded/forfeited) - a deliberate decision, not
 * an oversight: this store's vendors manage their own bookings end to end.
 */
export const PostVendorRentalDepositBodySchema = z.object({
  status: z.enum(["refunded", "partially_refunded", "forfeited"]),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostVendorRentalDepositBodySchema>
  >,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertVendorOwnsRental(req, id)

  const { status } = req.validatedBody

  const { result } = await updateRentalDepositWorkflow(req.scope).run({
    input: {
      rental_id: id,
      status,
    },
  })

  res.json({ rental: result })
}
