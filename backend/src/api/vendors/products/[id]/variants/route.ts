import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type {
  CreateProductVariantWorkflowInputDTO,
  HttpTypes,
} from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createProductVariantsWorkflow } from "@medusajs/medusa/core-flows"
import {
  assertOwnership,
  ensureVariantInventoryItem,
  VENDOR_PRODUCT_DETAIL_FIELDS,
} from "../../helpers"

/** Lists the variants of one of the vendor's products. */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertOwnership(req, id)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: variants, metadata } = await query.graph({
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
      "created_at",
      "updated_at",
      "options.*",
      "prices.*",
    ],
    filters: { product_id: [id] },
    pagination: { order: { created_at: "ASC" } },
  })

  res.json({
    variants,
    count: metadata?.count ?? variants.length,
  })
}

/**
 * Adds a variant to one of the vendor's products.
 *
 * product_id comes from the verified URL id rather than the body, so a vendor
 * cannot attach a variant to a product they do not own by passing a different
 * product_id alongside one of their own ids.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<HttpTypes.AdminCreateProductVariant>,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertOwnership(req, id)

  const { additional_data, ...rest } = req.validatedBody as Record<string, any>

  const { result } = await createProductVariantsWorkflow(req.scope).run({
    input: {
      product_variants: [{ ...rest, product_id: id }] as CreateProductVariantWorkflowInputDTO[],
      additional_data,
    },
  })

  if (rest.manage_inventory === true && result?.length) {
    for (const v of result) {
      await ensureVariantInventoryItem(req, v.id)
    }
  }

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
