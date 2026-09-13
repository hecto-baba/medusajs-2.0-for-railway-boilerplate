import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  dismissLinksWorkflow,
  updateLinksWorkflow,
} from "@medusajs/medusa/core-flows"
import {
  assertOwnership,
  assertVariantBelongsToProduct,
  VENDOR_VARIANT_FIELDS,
} from "../../../../../helpers"

const assertBoth = async (req: AuthenticatedMedusaRequest) => {
  const { id, variant_id } = req.params
  await assertOwnership(req, id)
  await assertVariantBelongsToProduct(req, id, variant_id)
}

/** Updates the required quantity on an existing variant-inventory link. */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  await assertBoth(req)
  const { variant_id, inventory_item_id } = req.params

  const body = req.validatedBody as { required_quantity?: number }

  await updateLinksWorkflow(req.scope).run({
    input: [
      {
        [Modules.PRODUCT]: { variant_id },
        [Modules.INVENTORY]: { inventory_item_id },
        data: { required_quantity: body.required_quantity },
      },
    ],
  })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [variant],
  } = await query.graph({
    entity: "variant",
    filters: { id: [variant_id] },
    fields: VENDOR_VARIANT_FIELDS,
  })

  res.status(200).json({ variant })
}

/** Detaches an inventory item from one of the vendor's variants. */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  await assertBoth(req)
  const { variant_id, inventory_item_id } = req.params

  const {
    result: [deleted],
  } = await dismissLinksWorkflow(req.scope).run({
    input: [
      {
        [Modules.PRODUCT]: { variant_id },
        [Modules.INVENTORY]: { inventory_item_id },
      },
    ],
  })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [parent],
  } = await query.graph({
    entity: "variant",
    filters: { id: [variant_id] },
    fields: VENDOR_VARIANT_FIELDS,
  })

  res.status(200).json({
    id: deleted,
    object: "variant-inventory-item-link",
    deleted: true,
    parent,
  })
}
