import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createVendorStockLocationWorkflow } from "../../../workflows/create-vendor-stock-location"

export const GetVendorStockLocationsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().optional(),
})

export const CreateVendorStockLocationSchema = z.object({
  name: z.string().min(1),
  address: z
    .object({
      address_1: z.string().optional(),
      address_2: z.string().optional(),
      city: z.string().optional(),
      country_code: z.string().min(2).max(2),
      postal_code: z.string().optional(),
      province: z.string().optional(),
      phone: z.string().optional(),
      company: z.string().optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof CreateVendorStockLocationSchema>>,
  res: MedusaResponse
) => {
  const { result } = await createVendorStockLocationWorkflow(req.scope).run({
    input: {
      vendor_admin_id: req.auth_context.actor_id,
      stock_location: req.validatedBody as any,
    },
  })

  res.status(201).json({ stock_location: result.stock_location })
}

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { limit, offset, q } = req.validatedQuery as unknown as z.infer<
    typeof GetVendorStockLocationsSchema
  >

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.id", "vendor.stock_locations.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  const vendorLocationIds = (vendorAdmin?.vendor?.stock_locations || [])
    .map((l: any) => l?.id)
    .filter(Boolean)

  if (!vendorLocationIds.length) {
    // If no vendor-specific locations exist yet, retrieve the store's default stock locations
    const { data: allLocations, metadata } = await query.graph({
      entity: "stock_location",
      fields: [
        "id",
        "name",
        "metadata",
        "created_at",
        "updated_at",
        "address.*",
        "fulfillment_sets.*",
        "fulfillment_providers.*",
      ],
      filters: {
        ...(q ? { name: { $ilike: `%${q}%` } } : {}),
      },
      pagination: { skip: offset, take: limit, order: { created_at: "ASC" } },
    })

    res.json({
      stock_locations: allLocations,
      count: metadata?.count ?? allLocations.length,
      limit,
      offset,
    })
    return
  }

  const { data: locations, metadata } = await query.graph({
    entity: "stock_location",
    fields: [
      "id",
      "name",
      "metadata",
      "created_at",
      "updated_at",
      "address.*",
      "fulfillment_sets.*",
      "fulfillment_providers.*",
    ],
    filters: {
      id: vendorLocationIds,
      ...(q ? { name: { $ilike: `%${q}%` } } : {}),
    },
    pagination: {
      skip: offset,
      take: limit,
      order: { created_at: "ASC" },
    },
  })

  res.json({
    stock_locations: locations,
    count: metadata?.count ?? locations.length,
    limit,
    offset,
  })
}
