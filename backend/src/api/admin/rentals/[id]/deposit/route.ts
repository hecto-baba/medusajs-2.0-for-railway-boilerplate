import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { updateRentalDepositWorkflow } from "../../../../../workflows/update-rental-deposit"
import { z } from "@medusajs/framework/zod"

export const PostRentalDepositBodySchema = z.object({
  status: z.enum(["refunded", "partially_refunded", "forfeited"]),
})

export const POST = async (
  req: MedusaRequest<z.infer<typeof PostRentalDepositBodySchema>>,
  res: MedusaResponse
) => {
  const { id } = req.params
  const { status } = req.validatedBody

  const { result } = await updateRentalDepositWorkflow(req.scope).run({
    input: {
      rental_id: id,
      status,
    },
  })

  res.json({ rental: result })
}
