import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  deleteInventoryItemWorkflow,
  updateInventoryItemsWorkflow,
} from "@medusajs/medusa/core-flows"
import {
  assertVendorOwnsInventoryItem,
  refetchVendorInventoryItem,
} from "../helpers"

export const PostVendorUpdateInventoryItemSchema = z.object({
  title: z.string().min(1).optional(),
  sku: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  hs_code: z.string().optional().nullable(),
  weight: z.number().optional().nullable(),
  length: z.number().optional().nullable(),
  height: z.number().optional().nullable(),
  width: z.number().optional().nullable(),
  origin_country: z.string().optional().nullable(),
  mid_code: z.string().optional().nullable(),
  material: z.string().optional().nullable(),
  requires_shipping: z.boolean().optional(),
  thumbnail: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertVendorOwnsInventoryItem(req, id)

  const inventoryItem = await refetchVendorInventoryItem(id, req.scope)

  if (!inventoryItem) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Inventory item with id: ${id} was not found.`
    )
  }

  res.json({ inventory_item: inventoryItem })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostVendorUpdateInventoryItemSchema>
  >,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertVendorOwnsInventoryItem(req, id)

  await updateInventoryItemsWorkflow(req.scope).run({
    input: {
      updates: [{ id, ...req.validatedBody }],
    },
  })

  const inventoryItem = await refetchVendorInventoryItem(id, req.scope)

  res.json({ inventory_item: inventoryItem })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertVendorOwnsInventoryItem(req, id)

  await deleteInventoryItemWorkflow(req.scope).run({
    input: [id],
  })

  res.json({
    id,
    object: "inventory_item",
    deleted: true,
  })
}
