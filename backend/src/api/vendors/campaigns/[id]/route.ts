import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { HttpTypes } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  deleteCampaignsWorkflow,
  updateCampaignsWorkflow,
} from "@medusajs/medusa/core-flows"
import { assertOwnership, VENDOR_CAMPAIGN_FIELDS } from "../helpers"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertOwnership(req, id)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [campaign],
  } = await query.graph({
    entity: "campaign",
    fields: VENDOR_CAMPAIGN_FIELDS,
    filters: { id: [id] },
  })

  res.json({ campaign })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateCampaign>,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertOwnership(req, id)

  const { result } = await updateCampaignsWorkflow(req.scope).run({
    input: {
      campaignsData: [{ id, ...req.validatedBody } as any],
    },
  })

  res.json({ campaign: result[0] })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertOwnership(req, id)

  await deleteCampaignsWorkflow(req.scope).run({ input: { ids: [id] } })

  res.json({ id, object: "campaign", deleted: true })
}
