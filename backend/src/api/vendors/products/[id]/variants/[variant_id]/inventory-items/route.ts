import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createLinksWorkflow } from "@medusajs/medusa/core-flows"
import {
  assertOwnership,
  assertVariantBelongsToProduct,
  VENDOR_VARIANT_FIELDS,
} from "../../../../helpers"
import { assertVendorOwnsInventoryItem } from "../../../../../inventory-items/helpers"

/**
 * Attaches an inventory item to one of the vendor's variants.
 *
 * Both ends are checked: the variant must belong to one of the seller's
 * products, and the inventory item must be the seller's own.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id, variant_id } = req.params
  await assertOwnership(req, id)
  await assertVariantBelongsToProduct(req, id, variant_id)

  const body = req.validatedBody as {
    inventory_item_id: string
    required_quantity?: number
  }

  // The item must be the seller's own, or its stock could be rewired from here.
  await assertVendorOwnsInventoryItem(req, body.inventory_item_id)

  await createLinksWorkflow(req.scope).run({
    input: [
      {
        [Modules.PRODUCT]: { variant_id },
        [Modules.INVENTORY]: { inventory_item_id: body.inventory_item_id },
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
