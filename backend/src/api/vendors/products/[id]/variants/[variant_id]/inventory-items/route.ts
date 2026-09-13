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

/**
 * Attaches an inventory item to one of the vendor's variants.
 *
 * The inventory item itself is not vendor-owned - the Inventory module has no
 * notion of a vendor - so what is checked here is the variant: a vendor may
 * only attach stock to variants of products they own. Attaching an item that
 * belongs to another vendor's stock is still possible by id, which matches
 * how the admin behaves; inventory items are shared store resources.
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
