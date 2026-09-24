import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  createInventoryItemsWorkflow,
  createInventoryLevelsWorkflow,
} from "@medusajs/medusa/core-flows"
import { MARKETPLACE_MODULE } from "../../../modules/marketplace"
import {
  getVendorId,
  getVendorInventoryItemIds,
  refetchVendorInventoryItem,
  VENDOR_INVENTORY_ITEM_FIELDS,
} from "./helpers"

export const GetVendorInventoryItemsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().optional(),
  sku: z.union([z.string(), z.array(z.string())]).optional(),
  origin_country: z.string().optional(),
  mid_code: z.string().optional(),
  hs_code: z.string().optional(),
  material: z.union([z.string(), z.array(z.string())]).optional(),
  requires_shipping: z.preprocess((val) => {
    if (typeof val === "string") {
      if (val === "true") return true
      if (val === "false") return false
    }
    return val
  }, z.boolean().optional()),
  location_id: z.union([z.string(), z.array(z.string())]).optional(),
  height: z.union([z.coerce.number(), z.record(z.string(), z.any())]).optional(),
  width: z.union([z.coerce.number(), z.record(z.string(), z.any())]).optional(),
  length: z.union([z.coerce.number(), z.record(z.string(), z.any())]).optional(),
  weight: z.union([z.coerce.number(), z.record(z.string(), z.any())]).optional(),
  order: z.string().optional(),
})

export const PostVendorCreateInventoryItemSchema = z.object({
  title: z.string().min(1, "Title is required"),
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
  requires_shipping: z.boolean().optional().default(true),
  thumbnail: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  location_levels: z
    .array(
      z.object({
        location_id: z.string(),
        stocked_quantity: z.number().int().min(0).default(0),
        incoming_quantity: z.number().int().min(0).default(0),
      })
    )
    .optional(),
  locations: z.record(z.string(), z.number().int().min(0)).optional(),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const {
    limit,
    offset,
    q,
    sku,
    origin_country,
    mid_code,
    hs_code,
    material,
    requires_shipping,
    location_id,
    height,
    width,
    length,
    weight,
    order,
  } = (req.validatedQuery ?? {}) as z.infer<
    typeof GetVendorInventoryItemsSchema
  >

  const ownedItemIds = await getVendorInventoryItemIds(req)

  if (!ownedItemIds.length) {
    res.json({
      inventory_items: [],
      count: 0,
      limit: limit ?? 20,
      offset: offset ?? 0,
    })
    return
  }

  const skuFilter = sku ? (Array.isArray(sku) ? sku : [sku]) : undefined

  const filters: Record<string, any> = {
    id: ownedItemIds,
  }

  if (skuFilter?.length) {
    filters.sku = skuFilter
  }
  if (origin_country) {
    filters.origin_country = origin_country
  }
  if (mid_code) {
    filters.mid_code = mid_code
  }
  if (hs_code) {
    filters.hs_code = hs_code
  }
  if (material) {
    filters.material = material
  }
  if (requires_shipping !== undefined) {
    filters.requires_shipping = requires_shipping
  }
  if (height !== undefined) {
    filters.height = height
  }
  if (width !== undefined) {
    filters.width = width
  }
  if (length !== undefined) {
    filters.length = length
  }
  if (weight !== undefined) {
    filters.weight = weight
  }
  if (location_id) {
    const locArr = Array.isArray(location_id) ? location_id : [location_id]
    if (locArr.length) {
      filters.location_levels = {
        location_id: locArr,
      }
    }
  }
  if (q) {
    filters.$or = [
      { title: { $ilike: `%${q}%` } },
      { sku: { $ilike: `%${q}%` } },
      { description: { $ilike: `%${q}%` } },
    ]
  }

  const orderField = order ? order.replace(/^-/, "") : null
  const orderDirection = order?.startsWith("-") ? "DESC" : "ASC"

  let orderConfig: Record<string, any> = { created_at: "DESC" }
  let inMemorySortField: "stocked_quantity" | "reserved_quantity" | null = null

  if (orderField === "stocked_quantity" || orderField === "reserved_quantity") {
    inMemorySortField = orderField
  } else if (orderField) {
    orderConfig = { [orderField]: orderDirection }
  }

  const { data: inventory_items, metadata } = await query.graph({
    entity: "inventory_item",
    fields: VENDOR_INVENTORY_ITEM_FIELDS,
    filters,
    pagination: {
      skip: offset ?? 0,
      take: limit ?? 20,
      order: orderConfig,
    },
  })

  const itemsWithComputedQuantities = inventory_items.map((item: any) => {
    const totalStocked = (item.location_levels ?? []).reduce(
      (sum: number, lvl: any) => sum + (Number(lvl.stocked_quantity) || 0),
      0
    )
    const totalReserved = (item.location_levels ?? []).reduce(
      (sum: number, lvl: any) => sum + (Number(lvl.reserved_quantity) || 0),
      0
    )
    return {
      ...item,
      stocked_quantity: totalStocked,
      reserved_quantity: totalReserved,
    }
  })

  if (inMemorySortField) {
    itemsWithComputedQuantities.sort((a: any, b: any) => {
      const aVal = Number(a[inMemorySortField!]) || 0
      const bVal = Number(b[inMemorySortField!]) || 0
      return orderDirection === "DESC" ? bVal - aVal : aVal - bVal
    })
  }

  res.json({
    inventory_items: itemsWithComputedQuantities,
    count: metadata?.count ?? itemsWithComputedQuantities.length,
    limit: limit ?? 20,
    offset: offset ?? 0,
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostVendorCreateInventoryItemSchema>
  >,
  res: MedusaResponse
) => {
  const vendorId = await getVendorId(req)
  const { location_levels, locations, ...itemData } = req.validatedBody

  // 1. Create the inventory item
  const { result } = await createInventoryItemsWorkflow(req.scope).run({
    input: {
      items: [
        {
          ...itemData,
          sku: itemData.sku ?? undefined,
          description: itemData.description ?? undefined,
          hs_code: itemData.hs_code ?? undefined,
          weight: itemData.weight ?? undefined,
          length: itemData.length ?? undefined,
          height: itemData.height ?? undefined,
          width: itemData.width ?? undefined,
          origin_country: itemData.origin_country ?? undefined,
          mid_code: itemData.mid_code ?? undefined,
          material: itemData.material ?? undefined,
          thumbnail: itemData.thumbnail ?? undefined,
          metadata: (itemData.metadata as Record<string, unknown>) ?? undefined,
        },
      ],
    },
  })

  const inventoryItem = result[0]

  // 2. Link the inventory item to the vendor
  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.REMOTE_LINK)
  await remoteLink.create([
    {
      [MARKETPLACE_MODULE]: { vendor_id: vendorId },
      [Modules.INVENTORY]: { inventory_item_id: inventoryItem.id },
    },
  ])

  // 3. Create initial location levels if supplied
  const levelsToCreate: {
    inventory_item_id: string
    location_id: string
    stocked_quantity: number
    incoming_quantity?: number
  }[] = []

  if (location_levels?.length) {
    for (const lvl of location_levels) {
      levelsToCreate.push({
        inventory_item_id: inventoryItem.id,
        location_id: lvl.location_id,
        stocked_quantity: lvl.stocked_quantity,
        incoming_quantity: lvl.incoming_quantity ?? 0,
      })
    }
  } else if (locations && Object.keys(locations).length) {
    for (const [location_id, stocked_quantity] of Object.entries(locations)) {
      if (typeof stocked_quantity === "number") {
        levelsToCreate.push({
          inventory_item_id: inventoryItem.id,
          location_id,
          stocked_quantity,
          incoming_quantity: 0,
        })
      }
    }
  }

  if (levelsToCreate.length) {
    await createInventoryLevelsWorkflow(req.scope).run({
      input: {
        inventory_levels: levelsToCreate,
      },
    })
  }

  const populatedItem = await refetchVendorInventoryItem(
    inventoryItem.id,
    req.scope
  )

  res.status(201).json({ inventory_item: populatedItem })
}
