import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  updateInventoryLevelsWorkflow,
} from "@medusajs/medusa/core-flows"
import { z } from "@medusajs/framework/zod"
import {
  assertOwnership,
  assertVariantBelongsToProduct,
} from "../../../../helpers"

/**
 * Stock levels for one of the vendor's variants, per location.
 *
 * Medusa keeps quantities on inventory *levels* - one row per
 * (inventory item, stock location) pair - not on the variant, so this cannot
 * be read or written through the product routes. The admin reaches them under
 * /admin/inventory-items/:id/location-levels, which takes an inventory item id
 * with no notion of who owns it.
 *
 * Scoping therefore runs through the variant: the product is checked against
 * the vendor, the variant against the product, and only the inventory items
 * actually linked to that variant are touched. A vendor cannot reach an
 * inventory item by id.
 */
const resolveInventoryItemIds = async (
  req: AuthenticatedMedusaRequest,
  variantId: string
): Promise<string[]> => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [variant],
  } = await query.graph({
    entity: "variant",
    fields: ["id", "inventory_items.inventory_item_id"],
    filters: { id: [variantId] },
  })

  return (
    variant?.inventory_items
      ?.map((item: { inventory_item_id?: string }) => item?.inventory_item_id)
      .filter(Boolean) ?? []
  )
}

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id, variant_id } = req.params
  await assertOwnership(req, id)
  await assertVariantBelongsToProduct(req, id, variant_id)

  const inventoryItemIds = await resolveInventoryItemIds(req, variant_id)

  // An unfiltered level query would return the whole store's stock, so a
  // variant with no inventory item has to short-circuit rather than fall
  // through.
  if (!inventoryItemIds.length) {
    res.json({ inventory_levels: [] })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: levels } = await query.graph({
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
    ],
    filters: { inventory_item_id: inventoryItemIds },
  })

  res.json({ inventory_levels: levels })
}

export const PostVendorInventoryLevelSchema = z.object({
  location_id: z.string(),
  stocked_quantity: z.number().int().min(0),
})

/**
 * Sets the stocked quantity at one location, creating the level if the
 * variant has never been stocked there.
 *
 * Upsert rather than separate create/update endpoints: from a seller's point
 * of view "how many do I have at this warehouse" is one field, and whether a
 * level row already exists is an implementation detail they should not have to
 * know about.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostVendorInventoryLevelSchema>
  >,
  res: MedusaResponse
) => {
  const { id, variant_id } = req.params
  await assertOwnership(req, id)
  await assertVariantBelongsToProduct(req, id, variant_id)

  const { location_id, stocked_quantity } = req.validatedBody

  const inventoryItemIds = await resolveInventoryItemIds(req, variant_id)

  if (!inventoryItemIds.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "This variant does not manage inventory, so it has no stock to set."
    )
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // The location id comes from the request, so it is checked against the
  // store's own locations - an unknown id would otherwise create a level
  // pointing at nothing.
  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id"],
    filters: { id: [location_id] },
  })

  if (!locations.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Stock location not found."
    )
  }

  const inventoryItemId = inventoryItemIds[0]

  const { data: existing } = await query.graph({
    entity: "inventory_level",
    fields: ["id"],
    filters: { inventory_item_id: [inventoryItemId], location_id: [location_id] },
  })

  if (existing.length) {
    await updateInventoryLevelsWorkflow(req.scope).run({
      input: {
        updates: [
          {
            inventory_item_id: inventoryItemId,
            location_id,
            stocked_quantity,
          },
        ],
      },
    })
  } else {
    await createInventoryLevelsWorkflow(req.scope).run({
      input: {
        inventory_levels: [
          {
            inventory_item_id: inventoryItemId,
            location_id,
            stocked_quantity,
          },
        ],
      },
    })
  }

  const { data: levels } = await query.graph({
    entity: "inventory_level",
    fields: [
      "id",
      "inventory_item_id",
      "location_id",
      "stocked_quantity",
      "reserved_quantity",
      "available_quantity",
      "stock_locations.id",
      "stock_locations.name",
    ],
    filters: { inventory_item_id: [inventoryItemId] },
  })

  res.json({ inventory_levels: levels })
}
