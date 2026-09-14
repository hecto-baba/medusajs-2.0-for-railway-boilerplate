import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { HttpTypes } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  deletePromotionsWorkflow,
  updatePromotionsWorkflow,
} from "@medusajs/medusa/core-flows"
import {
  assertCampaignBelongsToVendor,
  assertNoInlineCampaign,
  assertOwnership,
  assertPromotionRulesAreVendorScoped,
  VENDOR_PROMOTION_FIELDS,
} from "../helpers"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertOwnership(req, id)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [promotion],
  } = await query.graph({
    entity: "promotion",
    fields: VENDOR_PROMOTION_FIELDS,
    filters: { id: [id] },
  })

  res.json({ promotion })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdatePromotion>,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertOwnership(req, id)
  await assertPromotionRulesAreVendorScoped(req, req.validatedBody)
  assertNoInlineCampaign(req.validatedBody)
  await assertCampaignBelongsToVendor(
    req,
    (req.validatedBody as any).campaign_id
  )

  const { result } = await updatePromotionsWorkflow(req.scope).run({
    input: {
      promotionsData: [{ id, ...req.validatedBody } as any],
    },
  })

  res.json({ promotion: result[0] })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertOwnership(req, id)

  await deletePromotionsWorkflow(req.scope).run({ input: { ids: [id] } })

  res.json({ id, object: "promotion", deleted: true })
}
