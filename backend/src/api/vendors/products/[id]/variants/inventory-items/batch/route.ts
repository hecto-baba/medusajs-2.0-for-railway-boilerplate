import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { batchLinksWorkflow } from "@medusajs/medusa/core-flows"
import {
  assertOwnership,
  assertVariantIdsBelongToProduct,
} from "../../../../helpers"

type VariantInventoryInput = {
  variant_id: string
  inventory_item_id: string
  required_quantity?: number
}

/**
 * Shapes the flat request rows into the link payload batchLinksWorkflow wants.
 * Mirrors buildBatchVariantInventoryData in the admin's helpers.
 */
const buildLinks = (inputs: VariantInventoryInput[] = []) =>
  inputs.map((input) => ({
    [Modules.PRODUCT]: { variant_id: input.variant_id },
    [Modules.INVENTORY]: { inventory_item_id: input.inventory_item_id },
    ...(input.required_quantity !== undefined
      ? { data: { required_quantity: input.required_quantity } }
      : {}),
  }))

/**
 * Creates, updates and removes variant-inventory links in one call.
 *
 * Every arm carries variant ids in the body, so all three are verified against
 * the product in the URL before anything is written. Without that a vendor
 * could pass their own product id and another vendor's variant ids and rewire
 * that vendor's stock.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertOwnership(req, id)

  const body = req.validatedBody as {
    create?: VariantInventoryInput[]
    update?: VariantInventoryInput[]
    delete?: VariantInventoryInput[]
  }

  await assertVariantIdsBelongToProduct(req, id, [
    ...(body.create?.map((row) => row.variant_id) ?? []),
    ...(body.update?.map((row) => row.variant_id) ?? []),
    ...(body.delete?.map((row) => row.variant_id) ?? []),
  ])

  const { result } = await batchLinksWorkflow(req.scope).run({
    input: {
      create: buildLinks(body.create),
      update: buildLinks(body.update),
      delete: buildLinks(body.delete),
    },
  })

  res.status(200).json({
    created: result.created,
    updated: result.updated,
    deleted: result.deleted,
  })
}
