import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createReservationsWorkflow } from "@medusajs/medusa/core-flows"
import {
  assertVendorOwnsInventoryItem,
  getVendorInventoryItemIds,
} from "../inventory-items/helpers"

export const GetVendorReservationsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().optional(),
  inventory_item_id: z.union([z.string(), z.array(z.string())]).optional(),
  location_id: z.union([z.string(), z.array(z.string())]).optional(),
  order: z.string().optional(),
})

export const PostVendorCreateReservationSchema = z.object({
  inventory_item_id: z.string().min(1, "Inventory item id is required"),
  location_id: z.string().min(1, "Location id is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  description: z.string().optional().nullable(),
  line_item_id: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { limit, offset, q, inventory_item_id, location_id, order } = (
    req.validatedQuery ?? {}
  ) as z.infer<typeof GetVendorReservationsSchema>

  const ownedItemIds = await getVendorInventoryItemIds(req)

  if (!ownedItemIds.length) {
    res.json({
      reservations: [],
      count: 0,
      limit: limit ?? 20,
      offset: offset ?? 0,
    })
    return
  }

  let itemFilter = inventory_item_id
    ? (Array.isArray(inventory_item_id)
        ? inventory_item_id
        : [inventory_item_id]
      ).filter((id) => ownedItemIds.includes(id))
    : ownedItemIds

  if (!itemFilter.length) {
    res.json({
      reservations: [],
      count: 0,
      limit: limit ?? 20,
      offset: offset ?? 0,
    })
    return
  }

  const filters: Record<string, any> = {
    inventory_item_id: itemFilter,
  }

  if (location_id) {
    filters.location_id = Array.isArray(location_id) ? location_id : [location_id]
  }

  if (q && q.trim()) {
    const searchTerm = q.trim()
    const { data: matchingItems } = await query.graph({
      entity: "inventory_item",
      fields: ["id"],
      filters: {
        id: ownedItemIds,
        $or: [
          { title: { $ilike: `%${searchTerm}%` } },
          { sku: { $ilike: `%${searchTerm}%` } },
        ],
      },
    })

    const matchingIds = matchingItems.map((item: any) => item.id)

    if (matchingIds.length) {
      filters.$or = [
        { description: { $ilike: `%${searchTerm}%` } },
        { inventory_item_id: matchingIds },
      ]
    } else {
      filters.description = { $ilike: `%${searchTerm}%` }
    }
  }

  const orderConfig = order
    ? { [order.replace(/^-/, "")]: order.startsWith("-") ? "DESC" : "ASC" }
    : { created_at: "DESC" }

  const { data: reservations, metadata } = await query.graph({
    entity: "reservation",
    fields: [
      "id",
      "inventory_item_id",
      "location_id",
      "quantity",
      "description",
      "line_item_id",
      "metadata",
      "created_at",
      "updated_at",
      "inventory_item.id",
      "inventory_item.title",
      "inventory_item.sku",
      "inventory_item.thumbnail",
    ],
    filters,
    pagination: {
      skip: offset ?? 0,
      take: limit ?? 20,
      order: orderConfig,
    },
  })

  res.json({
    reservations,
    count: metadata?.count ?? reservations.length,
    limit: limit ?? 20,
    offset: offset ?? 0,
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostVendorCreateReservationSchema>
  >,
  res: MedusaResponse
) => {
  const { inventory_item_id, ...reservationData } = req.validatedBody

  // Verify the vendor owns this inventory item
  await assertVendorOwnsInventoryItem(req, inventory_item_id)

  const { result } = await createReservationsWorkflow(req.scope).run({
    input: {
      reservations: [
        {
          ...reservationData,
          inventory_item_id,
          description: reservationData.description ?? undefined,
          line_item_id: reservationData.line_item_id ?? undefined,
          metadata: (reservationData.metadata as Record<string, unknown>) ?? undefined,
        },
      ],
    },
  })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [reservation],
  } = await query.graph({
    entity: "reservation",
    fields: [
      "id",
      "inventory_item_id",
      "location_id",
      "quantity",
      "description",
      "line_item_id",
      "metadata",
      "created_at",
      "updated_at",
      "inventory_item.id",
      "inventory_item.title",
      "inventory_item.sku",
    ],
    filters: { id: [result[0].id] },
  })

  res.status(201).json({ reservation })
}
