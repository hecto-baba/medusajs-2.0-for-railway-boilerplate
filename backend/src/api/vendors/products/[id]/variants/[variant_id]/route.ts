import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { HttpTypes } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  deleteProductVariantsWorkflow,
  updateProductVariantsWorkflow,
} from "@medusajs/medusa/core-flows"
import {
  assertOwnership,
  assertVariantBelongsToProduct,
  VENDOR_PRODUCT_DETAIL_FIELDS,
} from "../../../helpers"

/**
 * Both ids in the URL are caller-controlled, so both are verified: the
 * product against the vendor, and the variant against the product. Checking
 * only the product would let a vendor pair their own product id with another
 * vendor's variant id.
 */
const assertBoth = async (req: AuthenticatedMedusaRequest) => {
  const { id, variant_id } = req.params
  await assertOwnership(req, id)
  await assertVariantBelongsToProduct(req, id, variant_id)
}

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  await assertBoth(req)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [variant],
  } = await query.graph({
    entity: "variant",
    fields: [
      "id",
      "title",
      "sku",
      "barcode",
      "ean",
      "upc",
      "manage_inventory",
      "allow_backorder",
      "weight",
      "length",
      "height",
      "width",
      "hs_code",
      "mid_code",
      "origin_country",
      "material",
      "metadata",
      "options.*",
      "prices.*",
    ],
    filters: { id: [req.params.variant_id] },
  })

  res.json({ variant })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateProductVariant>,
  res: MedusaResponse
) => {
  await assertBoth(req)
  const { id, variant_id } = req.params

  const { additional_data, ...update } = req.validatedBody as Record<string, any>

  await updateProductVariantsWorkflow(req.scope).run({
    input: {
      selector: { id: variant_id },
      update,
      additional_data,
    },
  })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [product],
  } = await query.graph({
    entity: "product",
    filters: { id },
    fields: VENDOR_PRODUCT_DETAIL_FIELDS,
  })

  res.status(200).json({ product })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  await assertBoth(req)
  const { variant_id } = req.params

  await deleteProductVariantsWorkflow(req.scope).run({
    input: { ids: [variant_id] },
  })

  res.json({ id: variant_id, object: "variant", deleted: true })
}
