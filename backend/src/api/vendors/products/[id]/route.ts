import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { HttpTypes } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  deleteProductsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { assertOwnership, VENDOR_PRODUCT_DETAIL_FIELDS } from "../helpers"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertOwnership(req, id)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [product],
  } = await query.graph({
    entity: "product",
    fields: VENDOR_PRODUCT_DETAIL_FIELDS,
    filters: { id: [id] },
  })

  res.json({ product })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateProduct>,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertOwnership(req, id)

  const { result } = await updateProductsWorkflow(req.scope).run({
    input: {
      selector: { id },
      update: req.validatedBody,
    },
  })

  res.json({ product: result[0] })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertOwnership(req, id)

  await deleteProductsWorkflow(req.scope).run({ input: { ids: [id] } })

  res.json({ id, object: "product", deleted: true })
}
