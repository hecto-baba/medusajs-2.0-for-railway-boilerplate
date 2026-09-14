import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  createInventoryLevelsWorkflow,
  deleteInventoryLevelsWorkflow,
  updateInventoryLevelsWorkflow,
} from "@medusajs/medusa/core-flows"
import {
  assertVendorOwnsInventoryItem,
  refetchVendorInventoryItem,
} from "../../../helpers"

export const PostVendorUpdateInventoryLevelSchema = z.object({
  stocked_quantity: z.number().int().min(0).optional(),
  incoming_quantity: z.number().int().min(0).optional(),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostVendorUpdateInventoryLevelSchema>
  >,
  res: MedusaResponse
) => {
  const { id, location_id } = req.params
  await assertVendorOwnsInventoryItem(req, id)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: existingLevels } = await query.graph({
    entity: "inventory_level",
    fields: ["id", "stocked_quantity", "incoming_quantity"],
    filters: { inventory_item_id: [id], location_id: [location_id] },
  })

  if (existingLevels.length) {
    await updateInventoryLevelsWorkflow(req.scope).run({
      input: {
        updates: [
          {
            inventory_item_id: id,
            location_id,
            stocked_quantity: req.validatedBody.stocked_quantity,
            incoming_quantity: req.validatedBody.incoming_quantity,
          },
        ],
      },
    })
  } else {
    await createInventoryLevelsWorkflow(req.scope).run({
      input: {
        inventory_levels: [
          {
            inventory_item_id: id,
            location_id,
            stocked_quantity: req.validatedBody.stocked_quantity ?? 0,
            incoming_quantity: req.validatedBody.incoming_quantity ?? 0,
          },
        ],
      },
    })
  }

  const inventoryItem = await refetchVendorInventoryItem(id, req.scope)

  res.json({ inventory_item: inventoryItem })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id, location_id } = req.params
  await assertVendorOwnsInventoryItem(req, id)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: existingLevels } = await query.graph({
    entity: "inventory_level",
    fields: ["id"],
    filters: { inventory_item_id: [id], location_id: [location_id] },
  })

  if (!existingLevels.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Inventory level for location: ${location_id} was not found.`
    )
  }

  await deleteInventoryLevelsWorkflow(req.scope).run({
    input: {
      id: existingLevels.map((l) => l.id),
    },
  })

  res.json({
    id: location_id,
    object: "inventory_level",
    deleted: true,
  })
}
