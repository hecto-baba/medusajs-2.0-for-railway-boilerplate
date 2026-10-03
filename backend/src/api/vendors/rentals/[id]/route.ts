import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { updateRentalWorkflow } from "../../../../workflows/update-rental"
import { assertVendorOwnsRental } from "../helpers"

/**
 * Mirrors /admin/rentals/:id - same workflow, same status enum, but scoped
 * to rentals booked on the calling vendor's own orders via
 * assertVendorOwnsRental.
 */
export const PostVendorRentalStatusBodySchema = z.object({
  status: z.enum(["active", "returned", "cancelled"]),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostVendorRentalStatusBodySchema>
  >,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertVendorOwnsRental(req, id)

  const { status } = req.validatedBody

  const { result } = await updateRentalWorkflow(req.scope).run({
    input: {
      rental_id: id,
      status,
    },
  })

  res.json({ rental: result })
}
