import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"
import {
  assertVendorOwnsServiceZone,
  getOwnedShippingScope,
} from "../shared/shipping-option-scope"
import {
  assertShippingOptionReferences,
  CreateVendorShippingOptionSchema,
  GetVendorShippingOptionsSchema,
  refetchShippingOption,
  SHIPPING_OPTION_FIELDS,
} from "./helpers"

export { CreateVendorShippingOptionSchema, GetVendorShippingOptionsSchema }

const DEFAULT_PROVIDER_ID = "manual_manual"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { limit, offset, q, stock_location_id } = req.validatedQuery as unknown as z.infer<
    typeof GetVendorShippingOptionsSchema
  >

  // Only options under the seller's own locations. An empty list means "no
  // constraint" downstream, so answer directly.
  const { zones, optionIds } = await getOwnedShippingScope(req)
  const zoneIds = (stock_location_id
    ? zones.filter((zone) => zone.stock_location_id === stock_location_id)
    : zones
  ).map((zone) => zone.id)

  if (!optionIds.length || !zoneIds.length) {
    res.json({ shipping_options: [], count: 0, limit, offset })
    return
  }

  const { data: options, metadata } = await query.graph({
    entity: "shipping_option",
    fields: SHIPPING_OPTION_FIELDS,
    filters: {
      id: optionIds,
      service_zone_id: zoneIds,
      ...(q ? { name: { $ilike: `%${q}%` } } : {}),
    },
    pagination: { skip: offset, take: limit, order: { created_at: "DESC" } },
  })

  res.json({
    shipping_options: options,
    count: metadata?.count ?? options.length,
    limit,
    offset,
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof CreateVendorShippingOptionSchema>>,
  res: MedusaResponse
) => {
  const body = req.validatedBody

  // The zone must be under one of the seller's own locations.
  const zone = await assertVendorOwnsServiceZone(req, body.service_zone_id)
  await assertShippingOptionReferences(req, body)

  // The provider must be linked to that location; default to the manual provider.
  const providerId = body.provider_id ?? DEFAULT_PROVIDER_ID
  if (!zone.provider_ids.includes(providerId)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "This fulfilment provider is not available at that location."
    )
  }

  const { result } = await createShippingOptionsWorkflow(req.scope).run({
    input: [
      {
        name: body.name,
        service_zone_id: body.service_zone_id,
        shipping_profile_id: body.shipping_profile_id,
        provider_id: providerId,
        price_type: body.price_type,
        type: body.shipping_option_type_id,
        prices: body.prices,
        metadata: body.metadata,
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      } as any,
    ],
  })

  res.status(201).json({ shipping_option: await refetchShippingOption(req, result[0].id) })
}
