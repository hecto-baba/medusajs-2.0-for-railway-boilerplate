import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { HttpTypes } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  deleteProductsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Confirms the product belongs to the calling vendor.
 *
 * Every handler in this file goes through here first. The product id comes
 * from the URL, so without this check any authenticated vendor could read or
 * edit another vendor's product simply by guessing an id - the actor gate
 * alone only proves the caller is *a* vendor, not that they own this row.
 */
const assertOwnership = async (
  req: AuthenticatedMedusaRequest,
  productId: string
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.products.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  const owns = vendorAdmin?.vendor?.products?.some(
    (product) => product?.id === productId
  )

  // Deliberately a 404 rather than a 403: telling a vendor that a product
  // exists but is not theirs would confirm the id belongs to someone else.
  if (!owns) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product not found.")
  }
}

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
    fields: [
      "id",
      "title",
      "subtitle",
      "description",
      "handle",
      "status",
      "thumbnail",
      "created_at",
      "updated_at",
      "collection.id",
      "collection.title",
      "sales_channels.id",
      "sales_channels.name",
      "images.*",
      "options.*",
      "options.values.*",
      "variants.*",
      "variants.options.*",
      "variants.prices.*",
    ],
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
