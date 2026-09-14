import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createInventoryLevelsWorkflow } from "@medusajs/medusa/core-flows"
import {
  assertVendorOwnsInventoryItem,
  refetchVendorInventoryItem,
} from "../../helpers"

export const PostVendorCreateInventoryLevelSchema = z.object({
  location_id: z.string(),
  stocked_quantity: z.number().int().min(0).default(0),
  incoming_quantity: z.number().int().min(0).optional().default(0),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertVendorOwnsInventoryItem(req, id)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: inventory_levels } = await query.graph({
    entity: "inventory_level",
    fields: [
      "id",
      "inventory_item_id",
      "location_id",
      "stocked_quantity",
      "reserved_quantity",
      "incoming_quantity",
      "available_quantity",
      "stock_locations.id",
      "stock_locations.name",
      "stock_locations.address.*",
    ],
    filters: { inventory_item_id: [id] },
  })

  res.json({ inventory_levels })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostVendorCreateInventoryLevelSchema>
  >,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertVendorOwnsInventoryItem(req, id)

  await createInventoryLevelsWorkflow(req.scope).run({
    input: {
      inventory_levels: [
        {
          ...req.validatedBody,
          inventory_item_id: id,
        },
      ],
    },
  })

  const inventoryItem = await refetchVendorInventoryItem(id, req.scope)

  res.status(201).json({ inventory_item: inventoryItem })
}
