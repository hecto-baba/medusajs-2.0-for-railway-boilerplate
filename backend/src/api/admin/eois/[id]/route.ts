import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { MedusaError } from "@medusajs/framework/utils"
import { EOI_MODULE } from "../../../../modules/expression-of-interest"
import ExpressionOfInterestModuleService from "../../../../modules/expression-of-interest/service"

/**
 * Mirrors admin/rentals/[id]/route.ts. Status transitions here are
 * pending -> cancelled only (admin manually voids an un-converted EOI) -
 * converted is only ever set by create-eoi-for-order.ts, never directly
 * via this route.
 */
export const PostEoiStatusBodySchema = z.object({
  status: z.literal("cancelled"),
})

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const query = req.scope.resolve("query")

  const { data: eois } = await query.graph({
    entity: "eoi",
    fields: [
      "id",
      "product_id",
      "variant_id",
      "customer_id",
      "customer_email",
      "order_id",
      "line_item_id",
      "value_type",
      "value_amount",
      "quoted_unit_price",
      "eoi_charged_amount",
      "remaining_amount",
      "status",
      "created_at",
    ],
    filters: { id },
  })

  if (!eois[0]) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Eoi with id ${id} not found`)
  }

  res.json({ eoi: eois[0] })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof PostEoiStatusBodySchema>>,
  res: MedusaResponse
) => {
  const { id } = req.params
  const { status } = req.validatedBody
  const eoiModuleService: ExpressionOfInterestModuleService = req.scope.resolve(EOI_MODULE)

  const existing = await eoiModuleService.retrieveEoi(id)

  if (existing.status !== "pending") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Only a pending EOI can be cancelled (current status: ${existing.status})`
    )
  }

  const updated = await eoiModuleService.updateEois({ id, status })

  res.json({ eoi: updated })
}
