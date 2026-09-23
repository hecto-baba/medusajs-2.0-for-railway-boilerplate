import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
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

export const PostVendorBatchInventoryItemLocationLevelsSchema = z.object({
  create: z
    .array(
      z.object({
        location_id: z.string(),
        stocked_quantity: z.number().int().min(0).optional().default(0),
        incoming_quantity: z.number().int().min(0).optional().default(0),
      })
    )
    .optional(),
  update: z
    .array(
      z.object({
        id: z.string().optional(),
        location_id: z.string(),
        stocked_quantity: z.number().int().min(0).optional(),
        incoming_quantity: z.number().int().min(0).optional(),
      })
    )
    .optional(),
  delete: z.array(z.string()).optional(),
  force: z.boolean().optional(),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostVendorBatchInventoryItemLocationLevelsSchema>
  >,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertVendorOwnsInventoryItem(req, id)

  const { create, update, delete: toDelete } = req.validatedBody

  // 1. Handle deletes
  if (toDelete?.length) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    // Make sure the levels actually belong to this item
    const { data: levels } = await query.graph({
      entity: "inventory_level",
      fields: ["id"],
      filters: { id: toDelete, inventory_item_id: [id] },
    })

    if (levels.length) {
      await deleteInventoryLevelsWorkflow(req.scope).run({
        input: {
          id: levels.map((l) => l.id),
        },
      })
    }
  }

  // 2. Handle creates
  if (create?.length) {
    await createInventoryLevelsWorkflow(req.scope).run({
      input: {
        inventory_levels: create.map((item) => ({
          ...item,
          inventory_item_id: id,
        })),
      },
    })
  }

  // 3. Handle updates
  if (update?.length) {
    await updateInventoryLevelsWorkflow(req.scope).run({
      input: {
        updates: update.map((item) => ({
          inventory_item_id: id,
          location_id: item.location_id,
          stocked_quantity: item.stocked_quantity,
          incoming_quantity: item.incoming_quantity,
        })),
      },
    })
  }

  const inventoryItem = await refetchVendorInventoryItem(id, req.scope)

  res.json({ inventory_item: inventoryItem })
}
