import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  updateStockLocationsWorkflow,
  deleteStockLocationsWorkflow,
} from "@medusajs/medusa/core-flows"

export const UpdateVendorStockLocationSchema = z.object({
  name: z.string().optional(),
  address: z
    .object({
      address_1: z.string().optional(),
      address_2: z.string().optional(),
      city: z.string().optional(),
      country_code: z.string().min(2).max(2).optional(),
      postal_code: z.string().optional(),
      province: z.string().optional(),
      phone: z.string().optional(),
      company: z.string().optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const locationId = req.params.id

  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: [
      "id",
      "name",
      "metadata",
      "created_at",
      "updated_at",
      "address.*",
      "fulfillment_sets.*",
      "fulfillment_sets.service_zones.*",
      "fulfillment_sets.service_zones.shipping_options.*",
      "fulfillment_providers.*",
      "sales_channels.*",
    ],
    filters: { id: locationId },
  })

  if (!locations?.length) {
    res.status(404).json({ message: "Stock location not found." })
    return
  }

  res.json({ stock_location: locations[0] })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof UpdateVendorStockLocationSchema>>,
  res: MedusaResponse
) => {
  const locationId = req.params.id

  const { result } = await updateStockLocationsWorkflow(req.scope).run({
    input: {
      selector: { id: locationId },
      update: req.validatedBody as any,
    },
  })

  res.json({ stock_location: result[0] })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const locationId = req.params.id

  await deleteStockLocationsWorkflow(req.scope).run({
    input: { ids: [locationId] },
  })

  res.json({ id: locationId, object: "stock_location", deleted: true })
}
