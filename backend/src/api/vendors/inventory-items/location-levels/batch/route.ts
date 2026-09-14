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
  assertVendorOwnsAllInventoryItems,
  getVendorInventoryItemIds,
} from "../../helpers"

export const PostVendorBatchInventoryItemsLocationLevelsSchema = z.object({
  create: z
    .array(
      z.object({
        inventory_item_id: z.string(),
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
        inventory_item_id: z.string(),
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
    z.infer<typeof PostVendorBatchInventoryItemsLocationLevelsSchema>
  >,
  res: MedusaResponse
) => {
  const { create, update, delete: toDelete } = req.validatedBody

  const referencedItemIds = new Set<string>()

  for (const c of create ?? []) {
    referencedItemIds.add(c.inventory_item_id)
  }
  for (const u of update ?? []) {
    referencedItemIds.add(u.inventory_item_id)
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  let levelsToDelete: { id: string; inventory_item_id: string }[] = []
  if (toDelete?.length) {
    const { data: levels } = await query.graph({
      entity: "inventory_level",
      fields: ["id", "inventory_item_id"],
      filters: { id: toDelete },
    })
    levelsToDelete = levels as any
    for (const l of levelsToDelete) {
      if (l.inventory_item_id) {
        referencedItemIds.add(l.inventory_item_id)
      }
    }
  }

  // Verify that vendor owns ALL affected inventory items!
  await assertVendorOwnsAllInventoryItems(
    req,
    Array.from(referencedItemIds),
    "One or more inventory items do not belong to your store."
  )

  // 1. Delete levels
  if (levelsToDelete.length) {
    await deleteInventoryLevelsWorkflow(req.scope).run({
      input: {
        id: levelsToDelete.map((l) => l.id),
      },
    })
  }

  // 2. Create levels
  if (create?.length) {
    await createInventoryLevelsWorkflow(req.scope).run({
      input: {
        inventory_levels: create,
      },
    })
  }

  // 3. Update levels
  if (update?.length) {
    await updateInventoryLevelsWorkflow(req.scope).run({
      input: {
        updates: update.map((u) => ({
          inventory_item_id: u.inventory_item_id,
          location_id: u.location_id,
          stocked_quantity: u.stocked_quantity,
          incoming_quantity: u.incoming_quantity,
        })),
      },
    })
  }

  res.json({
    success: true,
    created: create?.length ?? 0,
    updated: update?.length ?? 0,
    deleted: levelsToDelete.length,
  })
}
