import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { HttpTypes } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createVendorProductWorkflow } from "../../../workflows/create-vendor-product"

export const GetVendorProductsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().optional(),
  // Repeated query params arrive as an array, a single one as a string, so
  // both shapes are accepted and normalised to an array.
  status: z
    .union([
      z.enum(["draft", "proposed", "published", "rejected"]),
      z.array(z.enum(["draft", "proposed", "published", "rejected"])),
    ])
    .optional()
    .transform((value) =>
      value === undefined ? undefined : Array.isArray(value) ? value : [value]
    ),
  order: z.string().optional(),
})

import {
  createInventoryLevelsWorkflow,
  updateInventoryLevelsWorkflow,
} from "@medusajs/medusa/core-flows"
import { ensureVariantInventoryItem, getVendorId } from "./helpers"

export const POST = async (
  req: AuthenticatedMedusaRequest<HttpTypes.AdminCreateProduct>,
  res: MedusaResponse
) => {
  const { result } = await createVendorProductWorkflow(req.scope).run({
    input: {
      vendor_admin_id: req.auth_context.actor_id,
      product: req.validatedBody,
    },
  })

  const rawBody = ((req as any).body || {}) as any
  const variantsInput = rawBody.variants || (req.validatedBody as any)?.variants || []

  // Provision inventory items, remote links, and stocked inventory levels if requested
  if (result.product?.variants?.length) {
    try {
      const vendorId = await getVendorId(req)
      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

      // Resolve target stock location: request explicit override -> vendor's primary location -> store default location
      let stockLocationId: string | undefined = rawBody.stock_location_id
      if (!stockLocationId) {
        const {
          data: [vendorAdmin],
        } = await query.graph({
          entity: "vendor_admin",
          fields: ["vendor.id", "vendor.stock_locations.id"],
          filters: { id: [req.auth_context.actor_id] },
        })
        stockLocationId = vendorAdmin?.vendor?.stock_locations?.[0]?.id
      }

      if (!stockLocationId) {
        const { data: defaultLocations } = await query.graph({
          entity: "stock_location",
          fields: ["id"],
        })
        stockLocationId = defaultLocations?.[0]?.id
      }

      for (let i = 0; i < result.product.variants.length; i++) {
        const createdVariant = result.product.variants[i]
        const inputVariant =
          variantsInput[i] ||
          variantsInput.find(
            (v: any) =>
              (v.sku && v.sku === createdVariant.sku) ||
              (v.title && v.title === createdVariant.title)
          ) ||
          {}

        const shouldManageInventory = inputVariant.manage_inventory ?? true
        const inventoryQuantity =
          typeof inputVariant.inventory_quantity === "number"
            ? inputVariant.inventory_quantity
            : typeof inputVariant.metadata?.inventory_quantity === "number"
            ? inputVariant.metadata.inventory_quantity
            : undefined

        if (shouldManageInventory || inventoryQuantity !== undefined) {
          const inventoryItemId = await ensureVariantInventoryItem(
            req,
            createdVariant.id,
            vendorId
          )

          if (
            stockLocationId &&
            inventoryQuantity !== undefined &&
            inventoryQuantity >= 0
          ) {
            const { data: existingLevels } = await query.graph({
              entity: "inventory_level",
              fields: ["id"],
              filters: {
                inventory_item_id: [inventoryItemId],
                location_id: [stockLocationId],
              },
            })

            if (existingLevels.length) {
              await updateInventoryLevelsWorkflow(req.scope).run({
                input: {
                  updates: [
                    {
                      inventory_item_id: inventoryItemId,
                      location_id: stockLocationId,
                      stocked_quantity: inventoryQuantity,
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
                      location_id: stockLocationId,
                      stocked_quantity: inventoryQuantity,
                    },
                  ],
                },
              })
            }
          }
        }
      }
    } catch (inventoryErr) {
      console.error(
        "[POST /vendors/products] Inventory auto-provisioning error:",
        inventoryErr
      )
    }
  }

  res.status(201).json({ product: result.product })
}

/**
 * Lists the calling vendor's products, paginated.
 *
 * Scoping runs through the admin rather than taking a vendor id from the
 * request: actor_id comes from the verified token, so an admin cannot read
 * another vendor's catalogue by passing a different id.
 *
 * Paging is applied to the product query rather than to the link traversal.
 * Reading vendor.products.* returns the whole catalogue as one array, so
 * slicing it in JS would still load every row to show twenty - and `count`
 * has to describe the whole matching set, not the page, or the table's
 * pagination would end after the first page.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { limit, offset, q, status, order } = req.validatedQuery as unknown as z.infer<
    typeof GetVendorProductsSchema
  >

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.products.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  const productIds =
    vendorAdmin?.vendor?.products?.map((product) => product?.id).filter(Boolean) ??
    []

  // An unfiltered product query would list the whole store, so a vendor with
  // an empty catalogue has to short-circuit rather than fall through.
  if (!productIds.length) {
    res.json({ products: [], count: 0, limit, offset })
    return
  }

  const { data: products, metadata } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "handle",
      "status",
      "thumbnail",
      "created_at",
      "updated_at",
      "collection.id",
      "collection.title",
      "sales_channels.id",
      "sales_channels.name",
      "variants.id",
      "variants.title",
    ],
    filters: {
      id: productIds,
      ...(q ? { title: { $ilike: `%${q}%` } } : {}),
      ...(status?.length ? { status } : {}),
    },
    pagination: {
      skip: offset,
      take: limit,
      // A leading "-" means descending, matching the admin's ordering syntax.
      order: order
        ? { [order.replace(/^-/, "")]: order.startsWith("-") ? "DESC" : "ASC" }
        : { created_at: "DESC" },
    },
  })

  res.json({
    products,
    count: metadata?.count ?? products.length,
    limit,
    offset,
  })
}
