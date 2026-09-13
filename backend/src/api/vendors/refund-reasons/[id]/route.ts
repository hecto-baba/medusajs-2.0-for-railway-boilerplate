import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { HttpTypes } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateRefundReasonsWorkflow, deleteRefundReasonsWorkflow } from "@medusajs/medusa/core-flows"
import { assertVendorOwns } from "../../shared/vendor-scope"

const NOT_FOUND = "Refund reason not found."

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  await assertVendorOwns(req, "refund_reasons", req.params.id, NOT_FOUND)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [refund_reason],
  } = await query.graph({
    entity: "refund_reason",
    fields: ["id", "label", "code", "created_at", "updated_at"],
    filters: { id: [req.params.id] },
  })

  res.json({ refund_reason })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateRefundReason>,
  res: MedusaResponse
) => {
  await assertVendorOwns(req, "refund_reasons", req.params.id, NOT_FOUND)

  await updateRefundReasonsWorkflow(req.scope).run({
    input: [{ ...req.validatedBody, id: req.params.id }],
  })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [refund_reason],
  } = await query.graph({
    entity: "refund_reason",
    fields: ["id", "label", "code", "created_at", "updated_at"],
    filters: { id: [req.params.id] },
  })

  res.json({ refund_reason })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  await assertVendorOwns(req, "refund_reasons", req.params.id, NOT_FOUND)

  await deleteRefundReasonsWorkflow(req.scope).run({
    input: { ids: [req.params.id] },
  })

  res.json({ id: req.params.id, object: "refund_reason", deleted: true })
}
