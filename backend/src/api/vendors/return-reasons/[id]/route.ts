import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { HttpTypes } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateReturnReasonsWorkflow, deleteReturnReasonsWorkflow } from "@medusajs/medusa/core-flows"
import { assertVendorOwns } from "../../shared/vendor-scope"

const NOT_FOUND = "Return reason not found."

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  await assertVendorOwns(req, "return_reasons", req.params.id, NOT_FOUND)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [return_reason],
  } = await query.graph({
    entity: "return_reason",
    fields: ["id", "value", "label", "description", "created_at", "updated_at"],
    filters: { id: [req.params.id] },
  })

  res.json({ return_reason })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateReturnReason>,
  res: MedusaResponse
) => {
  await assertVendorOwns(req, "return_reasons", req.params.id, NOT_FOUND)

  const { result } = await updateReturnReasonsWorkflow(req.scope).run({
    input: {
      selector: { id: req.params.id },
      update: req.validatedBody,
    },
  })

  res.json({ return_reason: result[0] })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  await assertVendorOwns(req, "return_reasons", req.params.id, NOT_FOUND)

  await deleteReturnReasonsWorkflow(req.scope).run({
    input: { ids: [req.params.id] },
  })

  res.json({ id: req.params.id, object: "return_reason", deleted: true })
}
